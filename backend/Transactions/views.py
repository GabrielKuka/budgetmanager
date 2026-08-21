import csv
import hashlib
import io
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.http import HttpResponse
from django.db import transaction as db_transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework import exceptions, status
from rest_framework.authentication import (
    TokenAuthentication,
    get_authorization_header,
)
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from Accounts.models import Account, CashBalance, Holding, Security
from Currency.models import ExchangeRate
from Currency.services import (
    BGN,
    EUR,
    EUR_BGN_RATE,
    MissingExchangeRate,
    USD,
    convert_amount,
    get_latest_rate_date,
)
from tags.models import Tag
from tangible_assets.models import TangibleAsset

from .models import (
    ExpenseDetail,
    IncomeDetail,
    SavedSearch,
    SearchInsightDismissal,
    TradeDetail,
    Transaction,
    TransactionCategory,
    TransferDetail,
)
from .serializers import (
    TransactionCategorySerializer,
    TransactionReadSerializer,
    TransactionWriteSerializer,
)


class FlexibleTokenAuthentication(TokenAuthentication):
    """
    Accept both:
    - Authorization: Token <key>
    - Authorization: <key>
    """

    def authenticate(self, request):
        auth = get_authorization_header(request).split()
        if not auth:
            return None

        if len(auth) == 1:
            try:
                token = auth[0].decode()
            except UnicodeError:
                raise exceptions.AuthenticationFailed("Invalid token header.")
            return self.authenticate_credentials(token)

        if len(auth) == 2 and auth[0].lower() == b"token":
            try:
                token = auth[1].decode()
            except UnicodeError:
                raise exceptions.AuthenticationFailed("Invalid token header.")
            return self.authenticate_credentials(token)

        return super().authenticate(request)


def _to_decimal(value, default=Decimal("0")):
    if value in (None, ""):
        return default
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _round_2_decimal(value):
    return _to_decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _parse_single_date(raw_value):
    if not raw_value:
        return None

    try:
        return datetime.strptime(raw_value, "%Y-%m-%d").date()
    except ValueError:
        pass

    try:
        return datetime.strptime(raw_value, "%d-%m-%Y").date()
    except ValueError:
        return None


def _parse_date_range(request):
    from_raw = request.GET.get("from_date", "").strip()
    to_raw = request.GET.get("to_date", "").strip()

    from_date = _parse_single_date(from_raw)
    to_date = _parse_single_date(to_raw)

    if from_raw and not from_date:
        raise ValueError("Invalid from_date format.")
    if to_raw and not to_date:
        raise ValueError("Invalid to_date format.")
    if from_date and to_date and from_date > to_date:
        raise ValueError("from_date cannot be after to_date.")

    return from_date, to_date


def _transaction_queryset(
    user,
    transaction_type=None,
    from_date=None,
    to_date=None,
    include_drafts=False,
):
    queryset = (
        Transaction.objects.filter(user=user)
        .select_related(
            "income_detail__to_cash_balance__account",
            "income_detail__to_cash_balance__currency",
            "income_detail__category",
            "expense_detail__from_cash_balance__account",
            "expense_detail__from_cash_balance__currency",
            "expense_detail__category",
            "transfer_detail__from_cash_balance__account",
            "transfer_detail__from_cash_balance__currency",
            "transfer_detail__to_cash_balance__account",
            "transfer_detail__to_cash_balance__currency",
            "trade_detail__security",
            "trade_detail__holding",
            "trade_detail__tangible_asset",
            "trade_detail__cash_balance__account",
            "trade_detail__cash_balance__currency",
        )
        .prefetch_related("tags")
        .order_by("-pinned", "-date", "-id")
    )

    if not include_drafts:
        queryset = queryset.filter(is_draft=False)
    if transaction_type:
        queryset = queryset.filter(transaction_type=transaction_type)
    if from_date:
        queryset = queryset.filter(date__gte=from_date)
    if to_date:
        queryset = queryset.filter(date__lte=to_date)

    return queryset


def _group_transactions_by_type(rows):
    return {
        "incomes": [
            row for row in rows if row["transaction_type"] == "income"
        ],
        "expenses": [
            row for row in rows if row["transaction_type"] == "expense"
        ],
        "transfers": [
            row for row in rows if row["transaction_type"] == "transfer"
        ],
        "buys": [row for row in rows if row["transaction_type"] == "buy"],
        "sells": [row for row in rows if row["transaction_type"] == "sell"],
    }


def _apply_cash_delta(cash_balance, delta):
    CashBalance.objects.filter(pk=cash_balance.pk).update(
        balance=F("balance") + delta
    )
    cash_balance.refresh_from_db(fields=["balance"])


def _update_holding_for_buy(holding, quantity, price_per_unit):
    quantity = _to_decimal(quantity)
    price_per_unit = _to_decimal(price_per_unit)

    old_qty = _to_decimal(holding.quantity)
    old_avg = _to_decimal(holding.average_cost)
    old_total_cost = old_qty * old_avg
    purchase_total = quantity * price_per_unit

    new_qty = old_qty + quantity
    new_total_cost = old_total_cost + purchase_total
    new_avg = new_total_cost / new_qty if new_qty > 0 else Decimal("0")

    holding.quantity = new_qty
    holding.average_cost = new_avg
    holding.save(update_fields=["quantity", "average_cost", "updated_on"])


def _update_holding_for_buy_reversal(holding, quantity, price_per_unit):
    quantity = _to_decimal(quantity)
    price_per_unit = _to_decimal(price_per_unit)

    old_qty = _to_decimal(holding.quantity)
    old_avg = _to_decimal(holding.average_cost)
    old_total_cost = old_qty * old_avg
    reversal_total = quantity * price_per_unit

    new_qty = old_qty - quantity
    if new_qty <= 0:
        holding.quantity = Decimal("0")
        holding.average_cost = Decimal("0")
        holding.save(update_fields=["quantity", "average_cost", "updated_on"])
        return

    new_total_cost = old_total_cost - reversal_total
    if new_total_cost < 0:
        new_total_cost = Decimal("0")
    holding.quantity = new_qty
    holding.average_cost = new_total_cost / new_qty
    holding.save(update_fields=["quantity", "average_cost", "updated_on"])


def _update_holding_for_sell(holding, quantity):
    quantity = _to_decimal(quantity)
    old_qty = _to_decimal(holding.quantity)
    new_qty = old_qty - quantity
    if new_qty < 0:
        raise ValueError(
            f"Cannot sell {quantity}; holding has only {old_qty}."
        )
    holding.quantity = new_qty
    holding.save(update_fields=["quantity", "updated_on"])


def _update_holding_for_sell_reversal(holding, quantity):
    quantity = _to_decimal(quantity)
    holding.quantity = _to_decimal(holding.quantity) + quantity
    holding.save(update_fields=["quantity", "updated_on"])


def _delete_transaction_and_reverse(txn):
    with db_transaction.atomic():
        if txn.is_draft:
            txn.delete()
            return

        if txn.transaction_type == "income":
            detail = txn.income_detail
            _apply_cash_delta(detail.to_cash_balance, -detail.amount)

        elif txn.transaction_type == "expense":
            detail = txn.expense_detail
            _apply_cash_delta(detail.from_cash_balance, detail.amount)

        elif txn.transaction_type == "transfer":
            detail = txn.transfer_detail
            credited = detail.amount * detail.fx_rate
            _apply_cash_delta(detail.from_cash_balance, detail.amount)
            _apply_cash_delta(detail.to_cash_balance, -credited)

        elif txn.transaction_type == "buy":
            detail = txn.trade_detail
            total = detail.total_value
            _apply_cash_delta(detail.cash_balance, total)
            if detail.tangible_asset_id:
                asset = detail.tangible_asset
                if (
                    asset.valuations.filter(date__gt=txn.date).exists()
                    or asset.trades.exclude(transaction=txn)
                    .filter(transaction__date__gt=txn.date)
                    .exists()
                    or asset.status == "disposed"
                ):
                    raise ValueError(
                        "Undo this asset purchase from the asset timeline first."
                    )
                txn.delete()
                asset.delete()
                return
            if detail.holding_id:
                holding = Holding.objects.select_for_update().get(
                    pk=detail.holding_id
                )
                _update_holding_for_buy_reversal(
                    holding,
                    detail.quantity,
                    detail.price_per_unit,
                )

        elif txn.transaction_type == "sell":
            detail = txn.trade_detail
            total = detail.total_value
            _apply_cash_delta(detail.cash_balance, -total)
            if detail.tangible_asset_id:
                asset = detail.tangible_asset
                if asset.status != "sold" or asset.disposed_on != txn.date:
                    raise ValueError(
                        "Undo this asset sale from the asset timeline first."
                    )
                asset.status = "active"
                asset.disposed_on = None
                asset.save(
                    update_fields=["status", "disposed_on", "updated_on"]
                )
                txn.delete()
                return
            if detail.holding_id:
                holding = Holding.objects.select_for_update().get(
                    pk=detail.holding_id
                )
                _update_holding_for_sell_reversal(holding, detail.quantity)

        txn.delete()


def convert_currency(source, targets, target_date=None):
    rates = {}
    for target in targets:
        rates[target] = convert_amount(
            Decimal("1"),
            source,
            target,
            target_date,
        )

    if not rates:
        raise ValueError("No rates returned.")
    return rates


@api_view(["POST"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def toggle_pin(request):
    tx_id = request.data.get("id")
    if tx_id in (None, ""):
        return Response(
            {"error": "Field 'id' is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        txn = Transaction.objects.get(pk=int(tx_id), user=request.user)
    except (ValueError, Transaction.DoesNotExist):
        return Response(
            {"error": "Transaction not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    txn.pinned = not txn.pinned
    txn.save(update_fields=["pinned"])
    return Response(
        TransactionReadSerializer(txn).data,
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def add_transaction(request):
    serializer = TransactionWriteSerializer(
        data=request.data,
        context={"user": request.user},
    )
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    tx_type = data["resolved_type"]
    description = data.get("description", "")
    tx_date = data["date"]
    tags = data["resolved_tags"]
    is_draft = data.get("is_draft", False)

    try:
        with db_transaction.atomic():
            draft_kwargs = {}
            if is_draft:
                draft_kwargs = {
                    "is_draft": True,
                    "draft_created": timezone.now(),
                    "applied_at": None,
                }

            if tx_type == "income":
                amount = data["resolved_amount"]
                to_cash_balance = data["resolved_to_cash_balance"]
                category = data.get("resolved_category")
                txn = Transaction.objects.create(
                    user=request.user,
                    transaction_type=tx_type,
                    date=tx_date,
                    description=description,
                    amount=amount,
                    category=category,
                    from_account=None,
                    to_account=to_cash_balance.account,
                    **draft_kwargs,
                )
                IncomeDetail.objects.create(
                    transaction=txn,
                    to_cash_balance=to_cash_balance,
                    amount=amount,
                    category=category,
                )
                if not is_draft:
                    _apply_cash_delta(to_cash_balance, amount)

            elif tx_type == "expense":
                amount = data["resolved_amount"]
                from_cash_balance = data["resolved_from_cash_balance"]
                category = data.get("resolved_category")
                txn = Transaction.objects.create(
                    user=request.user,
                    transaction_type=tx_type,
                    date=tx_date,
                    description=description,
                    amount=amount,
                    category=category,
                    from_account=from_cash_balance.account,
                    to_account=None,
                    **draft_kwargs,
                )
                ExpenseDetail.objects.create(
                    transaction=txn,
                    from_cash_balance=from_cash_balance,
                    amount=amount,
                    category=category,
                )
                if not is_draft:
                    _apply_cash_delta(from_cash_balance, -amount)

            elif tx_type == "transfer":
                from_amount = data["resolved_from_amount"]
                fx_rate = data["resolved_fx_rate"]
                from_cash_balance = data["resolved_from_cash_balance"]
                to_cash_balance = data["resolved_to_cash_balance"]
                credited_amount = from_amount * fx_rate

                txn = Transaction.objects.create(
                    user=request.user,
                    transaction_type=tx_type,
                    date=tx_date,
                    description=description,
                    amount=from_amount,
                    category=None,
                    from_account=from_cash_balance.account,
                    to_account=to_cash_balance.account,
                    **draft_kwargs,
                )
                TransferDetail.objects.create(
                    transaction=txn,
                    from_cash_balance=from_cash_balance,
                    to_cash_balance=to_cash_balance,
                    amount=from_amount,
                    fx_rate=fx_rate,
                )
                if not is_draft:
                    _apply_cash_delta(from_cash_balance, -from_amount)
                    _apply_cash_delta(to_cash_balance, credited_amount)

            elif tx_type == "buy":
                from_cash_balance = data["resolved_from_cash_balance"]
                security = data["resolved_security"]
                quantity = data["resolved_quantity"]
                price_per_unit = data["resolved_price_per_unit"]
                total = quantity * price_per_unit

                provided_holding = data.get("resolved_holding")
                if provided_holding:
                    if (
                        provided_holding.account_id
                        != from_cash_balance.account_id
                    ):
                        raise ValueError(
                            "Provided holding account does not match source cash balance account."
                        )
                    holding = Holding.objects.select_for_update().get(
                        pk=provided_holding.pk
                    )
                else:
                    holding = (
                        Holding.objects.select_for_update()
                        .filter(
                            account=from_cash_balance.account,
                            security=security,
                        )
                        .first()
                    )
                    if not holding:
                        holding = Holding.objects.create(
                            account=from_cash_balance.account,
                            security=security,
                            quantity=Decimal("0"),
                            average_cost=Decimal("0"),
                        )

                txn = Transaction.objects.create(
                    user=request.user,
                    transaction_type=tx_type,
                    date=tx_date,
                    description=description,
                    amount=total,
                    category=None,
                    from_account=from_cash_balance.account,
                    to_account=None,
                    **draft_kwargs,
                )
                TradeDetail.objects.create(
                    transaction=txn,
                    security=security,
                    holding=holding,
                    cash_balance=from_cash_balance,
                    quantity=quantity,
                    price_per_unit=price_per_unit,
                )
                if not is_draft:
                    _apply_cash_delta(from_cash_balance, -total)
                    _update_holding_for_buy(holding, quantity, price_per_unit)

            elif tx_type == "sell":
                holding = Holding.objects.select_for_update().get(
                    pk=data["resolved_holding"].pk
                )
                quantity = data["resolved_quantity"]
                if quantity > holding.quantity:
                    raise ValueError(
                        f"Cannot sell {quantity}; holding has only {holding.quantity}."
                    )

                to_cash_balance = data["resolved_to_cash_balance"]
                price_per_unit = data["resolved_price_per_unit"]
                total = quantity * price_per_unit

                txn = Transaction.objects.create(
                    user=request.user,
                    transaction_type=tx_type,
                    date=tx_date,
                    description=description,
                    amount=total,
                    category=None,
                    from_account=None,
                    to_account=to_cash_balance.account,
                    **draft_kwargs,
                )
                TradeDetail.objects.create(
                    transaction=txn,
                    security=holding.security,
                    holding=holding,
                    cash_balance=to_cash_balance,
                    quantity=quantity,
                    price_per_unit=price_per_unit,
                )
                if not is_draft:
                    _apply_cash_delta(to_cash_balance, total)
                    _update_holding_for_sell(holding, quantity)

            else:
                raise ValueError(f"Unsupported transaction type: {tx_type}")

            if tags:
                txn.tags.set(tags)

        return Response(
            {"message": "Transaction added.", "id": txn.pk},
            status=status.HTTP_201_CREATED,
        )

    except ValueError as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )


@api_view(["PUT"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def apply_draft(request, pk):
    try:
        txn = Transaction.objects.select_related(
            "income_detail__to_cash_balance",
            "expense_detail__from_cash_balance",
            "transfer_detail__from_cash_balance",
            "transfer_detail__to_cash_balance",
            "trade_detail__holding",
            "trade_detail__cash_balance",
            "trade_detail__tangible_asset",
        ).get(pk=pk, user=request.user)
    except Transaction.DoesNotExist:
        return Response(
            {"error": "Transaction not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not txn.is_draft:
        return Response(
            {"error": "Transaction is not a draft."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        with db_transaction.atomic():
            _apply_draft_transaction(txn)

        return Response(
            TransactionReadSerializer(txn).data,
            status=status.HTTP_200_OK,
        )

    except ValueError as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )


def _apply_draft_transaction(txn):
    if not txn.is_draft:
        raise ValueError(f"Transaction {txn.pk} is not a draft.")
    tx_type = txn.transaction_type
    if tx_type == "income":
        detail = txn.income_detail
        _apply_cash_delta(detail.to_cash_balance, detail.amount)
    elif tx_type == "expense":
        detail = txn.expense_detail
        _apply_cash_delta(detail.from_cash_balance, -detail.amount)
    elif tx_type == "transfer":
        detail = txn.transfer_detail
        _apply_cash_delta(detail.from_cash_balance, -detail.amount)
        _apply_cash_delta(
            detail.to_cash_balance, detail.amount * detail.fx_rate
        )
    elif tx_type in ("buy", "sell"):
        detail = txn.trade_detail
        total = detail.total_value
        _apply_cash_delta(
            detail.cash_balance, -total if tx_type == "buy" else total
        )
        if detail.holding_id:
            holding = Holding.objects.select_for_update().get(
                pk=detail.holding_id
            )
            if tx_type == "buy":
                _update_holding_for_buy(
                    holding, detail.quantity, detail.price_per_unit
                )
            else:
                _update_holding_for_sell(holding, detail.quantity)
    else:
        raise ValueError(f"Unsupported transaction type: {tx_type}")
    txn.is_draft = False
    txn.applied_at = timezone.now()
    txn.save(update_fields=["is_draft", "applied_at"])


@api_view(["POST"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def delete_transaction(request):
    tx_id = request.data.get("id")
    if tx_id in (None, ""):
        return Response(
            {"error": "Field 'id' is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        txn = Transaction.objects.select_related(
            "income_detail__to_cash_balance",
            "expense_detail__from_cash_balance",
            "transfer_detail__from_cash_balance",
            "transfer_detail__to_cash_balance",
            "trade_detail__holding",
            "trade_detail__cash_balance",
            "trade_detail__tangible_asset",
        ).get(pk=int(tx_id), user=request.user)
    except (ValueError, Transaction.DoesNotExist):
        return Response(
            {"error": "Transaction not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    _delete_transaction_and_reverse(txn)
    return Response(
        {"message": "Transaction deleted."}, status=status.HTTP_200_OK
    )


@api_view(["DELETE"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def delete_transaction_by_pk(request, pk):
    try:
        txn = Transaction.objects.select_related(
            "income_detail__to_cash_balance",
            "expense_detail__from_cash_balance",
            "transfer_detail__from_cash_balance",
            "transfer_detail__to_cash_balance",
            "trade_detail__holding",
            "trade_detail__cash_balance",
            "trade_detail__tangible_asset",
        ).get(pk=pk, user=request.user)
    except Transaction.DoesNotExist:
        return Response(
            {"error": "Transaction not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    _delete_transaction_and_reverse(txn)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_transactions(request):
    try:
        from_date, to_date = _parse_date_range(request)
    except ValueError as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )

    include_drafts = request.GET.get("include_drafts", "").lower() in (
        "true",
        "1",
        "yes",
    )
    queryset = _transaction_queryset(
        request.user,
        transaction_type=None,
        from_date=from_date,
        to_date=to_date,
        include_drafts=include_drafts,
    )
    transactions = list(queryset)
    rows = TransactionReadSerializer(transactions, many=True).data
    error = _append_converted_amounts(
        transactions, rows, request.GET.get("currency")
    )
    if error:
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
    return Response(
        _group_transactions_by_type(rows), status=status.HTTP_200_OK
    )


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_expenses(request):
    try:
        from_date, to_date = _parse_date_range(request)
    except ValueError as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )
    include_drafts = request.GET.get("include_drafts", "").lower() in (
        "true",
        "1",
        "yes",
    )
    currency = request.GET.get("currency")
    queryset = _transaction_queryset(
        request.user,
        "expense",
        from_date,
        to_date,
        include_drafts=include_drafts,
    )
    transactions = list(queryset)
    rows = TransactionReadSerializer(transactions, many=True).data
    error = _append_converted_amounts(transactions, rows, currency)
    if error:
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
    return Response(rows)


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_incomes(request):
    try:
        from_date, to_date = _parse_date_range(request)
    except ValueError as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )
    include_drafts = request.GET.get("include_drafts", "").lower() in (
        "true",
        "1",
        "yes",
    )
    currency = request.GET.get("currency")
    queryset = _transaction_queryset(
        request.user,
        "income",
        from_date,
        to_date,
        include_drafts=include_drafts,
    )
    transactions = list(queryset)
    rows = TransactionReadSerializer(transactions, many=True).data
    error = _append_converted_amounts(transactions, rows, currency)
    if error:
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
    return Response(rows)


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_transfers(request):
    try:
        from_date, to_date = _parse_date_range(request)
    except ValueError as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )
    include_drafts = request.GET.get("include_drafts", "").lower() in (
        "true",
        "1",
        "yes",
    )
    currency = request.GET.get("currency")
    queryset = _transaction_queryset(
        request.user,
        "transfer",
        from_date,
        to_date,
        include_drafts=include_drafts,
    )
    transactions = list(queryset)
    rows = TransactionReadSerializer(transactions, many=True).data
    error = _append_converted_amounts(transactions, rows, currency)
    if error:
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
    return Response(rows)


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_all_transactions(request):
    queryset = _transaction_queryset(request.user)
    rows = TransactionReadSerializer(queryset, many=True).data
    return Response(
        _group_transactions_by_type(rows), status=status.HTTP_200_OK
    )


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_all_expenses(request):
    queryset = _transaction_queryset(request.user, "expense")
    return Response(TransactionReadSerializer(queryset, many=True).data)


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_all_incomes(request):
    queryset = _transaction_queryset(request.user, "income")
    return Response(TransactionReadSerializer(queryset, many=True).data)


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_all_transfers(request):
    queryset = _transaction_queryset(request.user, "transfer")
    return Response(TransactionReadSerializer(queryset, many=True).data)


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_trades(request):
    try:
        from_date, to_date = _parse_date_range(request)
    except ValueError as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )
    include_drafts = request.GET.get("include_drafts", "").lower() in (
        "true",
        "1",
        "yes",
    )
    queryset = _transaction_queryset(
        request.user,
        from_date=from_date,
        to_date=to_date,
        include_drafts=include_drafts,
    ).filter(
        transaction_type__in=["buy", "sell"],
        trade_detail__security__isnull=False,
    )
    return Response(TransactionReadSerializer(queryset, many=True).data)


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_all_trades(request):
    include_drafts = request.GET.get("include_drafts", "").lower() in (
        "true",
        "1",
        "yes",
    )
    queryset = _transaction_queryset(
        request.user, include_drafts=include_drafts
    ).filter(
        transaction_type__in=["buy", "sell"],
        trade_detail__security__isnull=False,
    )
    return Response(TransactionReadSerializer(queryset, many=True).data)


@api_view(["GET"])
def get_income_categories(request):
    queryset = TransactionCategory.objects.filter(category_type=0).order_by(
        "category"
    )
    return Response(TransactionCategorySerializer(queryset, many=True).data)


@api_view(["GET"])
def get_expense_categories(request):
    queryset = TransactionCategory.objects.filter(category_type=1).order_by(
        "category"
    )
    return Response(TransactionCategorySerializer(queryset, many=True).data)


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def search(request):
    try:
        dataset = _build_search_dataset(request)
    except ValueError as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )
    except MissingExchangeRate as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )

    page = _bounded_int(request.GET.get("page"), 1, 1, 1000000)
    page_size = _bounded_int(request.GET.get("page_size"), 25, 1, 100)
    start = (page - 1) * page_size
    total = len(dataset["rows"])
    return Response(
        {
            "results": dataset["rows"][start : start + page_size],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": max(1, (total + page_size - 1) // page_size),
            "facets": _search_facets(dataset["rows"]),
            "summary": _search_summary(dataset["rows"]),
            "breakdowns": _search_breakdowns(dataset["rows"]),
            "comparison": _search_comparison(
                request, dataset["summary_inputs"]
            ),
        }
    )


def _csv_values(request, name):
    values = request.GET.getlist(name)
    result = []
    for value in values:
        result.extend(
            part.strip() for part in value.split(",") if part.strip()
        )
    return result


def _int_values(request, name):
    try:
        return [int(value) for value in _csv_values(request, name)]
    except ValueError:
        raise ValueError(f"{name} must contain integer IDs.")


def _bounded_int(value, default, minimum, maximum):
    try:
        parsed = int(value) if value not in (None, "") else default
    except (TypeError, ValueError):
        raise ValueError("Pagination values must be integers.")
    return max(minimum, min(maximum, parsed))


def _search_queryset(request, date_override=None):
    queryset = _transaction_queryset(request.user, include_drafts=True)
    draft_status = request.GET.get("draft_status", "applied")
    if draft_status == "applied":
        queryset = queryset.filter(is_draft=False)
    elif draft_status == "draft":
        queryset = queryset.filter(is_draft=True)
    elif draft_status != "all":
        raise ValueError("draft_status must be applied, draft, or all.")

    types = _csv_values(request, "types")
    valid_types = {choice[0] for choice in Transaction.TRANSACTION_TYPES}
    if any(value not in valid_types for value in types):
        raise ValueError("types contains an unsupported transaction type.")
    if types:
        queryset = queryset.filter(transaction_type__in=types)

    account_ids = _int_values(request, "account_ids")
    if account_ids:
        queryset = queryset.filter(
            Q(income_detail__to_cash_balance__account_id__in=account_ids)
            | Q(expense_detail__from_cash_balance__account_id__in=account_ids)
            | Q(transfer_detail__from_cash_balance__account_id__in=account_ids)
            | Q(transfer_detail__to_cash_balance__account_id__in=account_ids)
            | Q(trade_detail__cash_balance__account_id__in=account_ids)
        )
    balance_ids = _int_values(request, "cash_balance_ids")
    if balance_ids:
        queryset = queryset.filter(
            Q(income_detail__to_cash_balance_id__in=balance_ids)
            | Q(expense_detail__from_cash_balance_id__in=balance_ids)
            | Q(transfer_detail__from_cash_balance_id__in=balance_ids)
            | Q(transfer_detail__to_cash_balance_id__in=balance_ids)
            | Q(trade_detail__cash_balance_id__in=balance_ids)
        )
    category_ids = _int_values(request, "category_ids")
    if category_ids:
        queryset = queryset.filter(
            Q(income_detail__category_id__in=category_ids)
            | Q(expense_detail__category_id__in=category_ids)
        )
    tag_ids = _int_values(request, "tag_ids")
    if tag_ids:
        for tag_id in tag_ids:
            queryset = queryset.filter(tags__id=tag_id)

    query = request.GET.get("q", request.GET.get("query", "")).strip()
    if query:
        queryset = queryset.filter(
            Q(description__icontains=query)
            | Q(income_detail__category__category__icontains=query)
            | Q(expense_detail__category__category__icontains=query)
            | Q(income_detail__to_cash_balance__account__name__icontains=query)
            | Q(
                expense_detail__from_cash_balance__account__name__icontains=query
            )
            | Q(
                transfer_detail__from_cash_balance__account__name__icontains=query
            )
            | Q(
                transfer_detail__to_cash_balance__account__name__icontains=query
            )
            | Q(trade_detail__cash_balance__account__name__icontains=query)
            | Q(
                income_detail__to_cash_balance__currency__code__icontains=query
            )
            | Q(
                expense_detail__from_cash_balance__currency__code__icontains=query
            )
            | Q(
                transfer_detail__from_cash_balance__currency__code__icontains=query
            )
            | Q(
                transfer_detail__to_cash_balance__currency__code__icontains=query
            )
            | Q(trade_detail__cash_balance__currency__code__icontains=query)
            | Q(trade_detail__security__ticker__icontains=query)
            | Q(trade_detail__security__name__icontains=query)
            | Q(trade_detail__tangible_asset__name__icontains=query)
            | Q(trade_detail__tangible_asset__asset_type__icontains=query)
            | Q(tags__name__icontains=query)
        )

    currencies = [
        value.upper() for value in _csv_values(request, "currencies")
    ]
    if currencies:
        queryset = queryset.filter(
            Q(income_detail__to_cash_balance__currency__code__in=currencies)
            | Q(
                expense_detail__from_cash_balance__currency__code__in=currencies
            )
            | Q(
                transfer_detail__from_cash_balance__currency__code__in=currencies
            )
            | Q(trade_detail__cash_balance__currency__code__in=currencies)
        )
    pinned = request.GET.get("pinned", "")
    if pinned in ("true", "1"):
        queryset = queryset.filter(pinned=True)
    elif pinned in ("false", "0"):
        queryset = queryset.filter(pinned=False)
    elif pinned:
        raise ValueError("pinned must be true or false.")

    if date_override:
        from_date, to_date = date_override
    else:
        from_date, to_date = _parse_date_range(request)
    if from_date:
        queryset = queryset.filter(date__gte=from_date)
    if to_date:
        queryset = queryset.filter(date__lte=to_date)
    return queryset.distinct(), query, from_date, to_date


def _transaction_display(txn, row, converted_amount, query=""):
    category = (
        _transaction_category_name(txn)
        if txn.transaction_type in ("income", "expense")
        else None
    )
    from_balance = None
    to_balance = None
    if txn.transaction_type == "income":
        to_balance = txn.income_detail.to_cash_balance
    elif txn.transaction_type == "expense":
        from_balance = txn.expense_detail.from_cash_balance
    elif txn.transaction_type == "transfer":
        from_balance = txn.transfer_detail.from_cash_balance
        to_balance = txn.transfer_detail.to_cash_balance
    elif txn.transaction_type in ("buy", "sell"):
        if txn.transaction_type == "buy":
            from_balance = txn.trade_detail.cash_balance
        else:
            to_balance = txn.trade_detail.cash_balance
    haystacks = {
        "description": txn.description or "",
        "category": category or "",
        "from_account": from_balance.account.name if from_balance else "",
        "to_account": to_balance.account.name if to_balance else "",
        "asset": row.get("security_name")
        or row.get("tangible_asset_name")
        or "",
        "tags": " ".join(tag.name for tag in txn.tags.all()),
    }
    matched_fields = [
        name
        for name, value in haystacks.items()
        if query and query.lower() in value.lower()
    ]
    row.update(
        {
            "category_name": category,
            "from_account_name": (
                from_balance.account.name if from_balance else None
            ),
            "to_account_name": to_balance.account.name if to_balance else None,
            "currency": _transaction_currency_code(txn),
            "converted_amount": float(_round_2_decimal(converted_amount)),
            "matched_fields": matched_fields,
        }
    )
    return row


def _build_search_dataset(request, date_override=None):
    queryset, query, from_date, to_date = _search_queryset(
        request, date_override
    )
    transactions = list(queryset)
    reporting_currency = request.GET.get("currency", "EUR").upper()
    converted = _converted_transaction_amounts(
        transactions, reporting_currency
    )
    serialized = TransactionReadSerializer(transactions, many=True).data
    rows = [
        _transaction_display(txn, dict(row), amount, query)
        for txn, row, amount in zip(transactions, serialized, converted)
    ]
    minimum = request.GET.get("min_amount")
    maximum = request.GET.get("max_amount")
    try:
        minimum = _to_decimal(minimum) if minimum not in (None, "") else None
        maximum = _to_decimal(maximum) if maximum not in (None, "") else None
    except Exception:
        raise ValueError("Amount filters must be numeric.")
    if minimum is not None:
        rows = [
            row
            for row in rows
            if _to_decimal(row["converted_amount"]) >= minimum
        ]
    if maximum is not None:
        rows = [
            row
            for row in rows
            if _to_decimal(row["converted_amount"]) <= maximum
        ]
    if minimum is not None and maximum is not None and minimum > maximum:
        raise ValueError("min_amount cannot exceed max_amount.")

    sort = request.GET.get("sort", "date_desc")
    sorters = {
        "date_desc": (lambda row: (row["date"], row["id"]), True),
        "date_asc": (lambda row: (row["date"], row["id"]), False),
        "amount_desc": (
            lambda row: (row["converted_amount"], row["id"]),
            True,
        ),
        "amount_asc": (
            lambda row: (row["converted_amount"], row["id"]),
            False,
        ),
        "created_desc": (lambda row: (row["created_on"], row["id"]), True),
        "relevance": (
            lambda row: (len(row["matched_fields"]), row["date"], row["id"]),
            True,
        ),
    }
    if sort not in sorters:
        raise ValueError("Unsupported sort value.")
    key, reverse = sorters[sort]
    rows.sort(key=key, reverse=reverse)
    if sort != "relevance":
        rows.sort(key=lambda row: bool(row["pinned"]), reverse=True)
    return {
        "transactions": transactions,
        "rows": rows,
        "reporting_currency": reporting_currency,
        "summary_inputs": (from_date, to_date),
    }


def _search_facets(rows):
    def counted(values):
        counts = defaultdict(int)
        for identifier, label in values:
            if identifier is not None:
                counts[(identifier, label)] += 1
        return [
            {"id": key[0], "label": key[1], "count": value}
            for key, value in sorted(
                counts.items(), key=lambda item: str(item[0][1])
            )
        ]

    return {
        "types": counted(
            (row["transaction_type"], row["transaction_type"].title())
            for row in rows
        ),
        "accounts": counted(
            (
                row.get("from_account") or row.get("to_account"),
                row.get("from_account_name") or row.get("to_account_name"),
            )
            for row in rows
        ),
        "categories": counted(
            (row.get("category"), row.get("category_name")) for row in rows
        ),
        "tags": counted(
            (tag["id"], tag["name"])
            for row in rows
            for tag in row.get("tags", [])
        ),
        "currencies": counted(
            (row.get("currency"), row.get("currency")) for row in rows
        ),
    }


def _search_summary(rows):
    totals = defaultdict(Decimal)
    for row in rows:
        totals[row["transaction_type"]] += _to_decimal(row["converted_amount"])
    amounts = [_to_decimal(row["converted_amount"]) for row in rows]
    ordered = sorted(amounts)
    median = Decimal("0")
    if ordered:
        middle = len(ordered) // 2
        median = (
            ordered[middle]
            if len(ordered) % 2
            else (ordered[middle - 1] + ordered[middle]) / 2
        )
    income = totals["income"]
    expense = totals["expense"]
    return {
        "count": len(rows),
        "income": float(_round_2_decimal(income)),
        "expenses": float(_round_2_decimal(expense)),
        "net_cash_flow": float(_round_2_decimal(income - expense)),
        "transfers": float(_round_2_decimal(totals["transfer"])),
        "trade_value": float(_round_2_decimal(totals["buy"] + totals["sell"])),
        "average": (
            float(_round_2_decimal(sum(amounts, Decimal("0")) / len(amounts)))
            if amounts
            else 0
        ),
        "median": float(_round_2_decimal(median)),
        "largest": float(_round_2_decimal(max(amounts))) if amounts else 0,
    }


def _search_breakdowns(rows):
    monthly = defaultdict(
        lambda: {"income": Decimal("0"), "expenses": Decimal("0")}
    )
    category = defaultdict(Decimal)
    account = defaultdict(Decimal)
    for row in rows:
        amount = _to_decimal(row["converted_amount"])
        month = str(row["date"])[:7]
        if row["transaction_type"] == "income":
            monthly[month]["income"] += amount
        elif row["transaction_type"] == "expense":
            monthly[month]["expenses"] += amount
            category[
                (
                    row.get("category"),
                    row.get("category_name") or "Uncategorized",
                )
            ] += amount
        account[
            (
                row.get("from_account") or row.get("to_account"),
                row.get("from_account_name")
                or row.get("to_account_name")
                or "Unknown",
            )
        ] += amount
    return {
        "monthly": [
            {
                "month": month,
                "income": float(_round_2_decimal(value["income"])),
                "expenses": float(_round_2_decimal(value["expenses"])),
            }
            for month, value in sorted(monthly.items())
        ],
        "categories": [
            {
                "id": key[0],
                "label": key[1],
                "value": float(_round_2_decimal(value)),
            }
            for key, value in sorted(
                category.items(), key=lambda item: item[1], reverse=True
            )
        ],
        "accounts": [
            {
                "id": key[0],
                "label": key[1],
                "value": float(_round_2_decimal(value)),
            }
            for key, value in sorted(
                account.items(), key=lambda item: item[1], reverse=True
            )
        ],
    }


def _search_comparison(request, date_range):
    from_date, to_date = date_range
    if not from_date or not to_date:
        return None
    duration = (to_date - from_date).days + 1
    previous_to = from_date - timedelta(days=1)
    previous_from = previous_to - timedelta(days=duration - 1)
    previous = _build_search_dataset(request, (previous_from, previous_to))
    summary = _search_summary(previous["rows"])
    return {
        "from_date": previous_from,
        "to_date": previous_to,
        "summary": summary,
    }


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def search_suggestions(request):
    query = request.GET.get("q", "").strip()
    if len(query) < 1:
        return Response({"suggestions": []})
    limit = _bounded_int(request.GET.get("limit"), 8, 1, 20)
    user = request.user
    suggestions = []

    def add(kind, identifier, label):
        if label and not any(
            item["kind"] == kind and item["id"] == identifier
            for item in suggestions
        ):
            suggestions.append(
                {"kind": kind, "id": identifier, "label": label}
            )

    for account in Account.objects.filter(
        user=user, name__icontains=query
    ).order_by("name")[:limit]:
        add("account", account.id, account.name)
    category_ids = (
        Transaction.objects.filter(user=user)
        .filter(
            Q(income_detail__category__category__icontains=query)
            | Q(expense_detail__category__category__icontains=query)
        )
        .values_list(
            "income_detail__category_id", "expense_detail__category_id"
        )
    )
    ids = {item for pair in category_ids for item in pair if item}
    for category in TransactionCategory.objects.filter(id__in=ids).order_by(
        "category"
    )[:limit]:
        add("category", category.id, category.category)
    for tag in (
        Tag.objects.filter(transaction__user=user, name__icontains=query)
        .distinct()
        .order_by("name")[:limit]
    ):
        add("tag", tag.id, tag.name)
    for security in (
        Security.objects.filter(trades__transaction__user=user)
        .filter(Q(ticker__icontains=query) | Q(name__icontains=query))
        .distinct()[:limit]
    ):
        add("security", security.id, f"{security.ticker} · {security.name}")
    for asset in TangibleAsset.objects.filter(
        user=user, name__icontains=query
    ).order_by("name")[:limit]:
        add("asset", asset.id, asset.name)
    return Response({"suggestions": suggestions[:limit]})


def _saved_search_row(saved):
    return {
        "id": saved.id,
        "name": saved.name,
        "filters": saved.filters,
        "sort": saved.sort,
        "grouping": saved.grouping,
        "created_on": saved.created_on,
        "updated_on": saved.updated_on,
    }


def _validate_saved_search(data):
    name = str(data.get("name", "")).strip()
    filters = data.get("filters", {})
    sort = data.get("sort", "date_desc")
    grouping = data.get("grouping", "none")
    if not name or len(name) > 100:
        raise ValueError(
            "name is required and must be at most 100 characters."
        )
    if not isinstance(filters, dict):
        raise ValueError("filters must be an object.")
    if sort not in {
        "date_desc",
        "date_asc",
        "amount_desc",
        "amount_asc",
        "created_desc",
        "relevance",
    }:
        raise ValueError("Unsupported sort value.")
    if grouping not in {"none", "type", "account", "category", "month"}:
        raise ValueError("Unsupported grouping value.")
    return name, filters, sort, grouping


@api_view(["GET", "POST"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def saved_searches(request):
    if request.method == "GET":
        return Response(
            [
                _saved_search_row(item)
                for item in SavedSearch.objects.filter(user=request.user)
            ]
        )
    try:
        name, filters, sort, grouping = _validate_saved_search(request.data)
        saved = SavedSearch.objects.create(
            user=request.user,
            name=name,
            filters=filters,
            sort=sort,
            grouping=grouping,
        )
    except ValueError as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as exc:
        if "UNIQUE" in str(exc):
            return Response(
                {"error": "A saved search with this name already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        raise
    return Response(_saved_search_row(saved), status=status.HTTP_201_CREATED)


@api_view(["PUT", "DELETE"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def saved_search_detail(request, pk):
    try:
        saved = SavedSearch.objects.get(pk=pk, user=request.user)
    except SavedSearch.DoesNotExist:
        return Response(
            {"error": "Saved search not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    if request.method == "DELETE":
        saved.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    try:
        name, filters, sort, grouping = _validate_saved_search(request.data)
        saved.name, saved.filters, saved.sort, saved.grouping = (
            name,
            filters,
            sort,
            grouping,
        )
        saved.save()
    except ValueError as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )
    return Response(_saved_search_row(saved))


def _normalized_description(value):
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def _row_date(row):
    value = row["date"]
    return (
        value
        if isinstance(value, date)
        else datetime.strptime(str(value), "%Y-%m-%d").date()
    )


def _insight_fingerprint(kind, parts):
    return hashlib.sha256(
        f"{kind}|{'|'.join(map(str, parts))}".encode()
    ).hexdigest()


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def search_insights(request):
    try:
        rows = _build_search_dataset(request)["rows"]
    except (ValueError, MissingExchangeRate) as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )
    dismissed = set(
        SearchInsightDismissal.objects.filter(user=request.user).values_list(
            "insight_type", "fingerprint"
        )
    )
    duplicates = []
    duplicate_groups = defaultdict(list)
    for row in rows:
        account_path = (row.get("from_account"), row.get("to_account"))
        key = (
            row["transaction_type"],
            round(row["converted_amount"], 2),
            account_path,
            _normalized_description(row.get("description")),
        )
        duplicate_groups[key].append(row)
    for key, candidates in duplicate_groups.items():
        candidates.sort(key=_row_date)
        for index, current in enumerate(candidates[:-1]):
            following = candidates[index + 1]
            if (_row_date(following) - _row_date(current)).days <= 3:
                ids = sorted([current["id"], following["id"]])
                fingerprint = _insight_fingerprint("duplicate", ids)
                if ("duplicate", fingerprint) not in dismissed:
                    duplicates.append(
                        {
                            "type": "duplicate",
                            "fingerprint": fingerprint,
                            "transaction_ids": ids,
                            "transactions": [current, following],
                            "confidence": "high",
                            "reason": "Same type, amount, account path, and description within 3 days.",
                        }
                    )

    recurring = []
    recurring_groups = defaultdict(list)
    for row in rows:
        if row["transaction_type"] in ("income", "expense"):
            key = (
                row["transaction_type"],
                row.get("from_account") or row.get("to_account"),
                row.get("category"),
                _normalized_description(row.get("description")),
            )
            recurring_groups[key].append(row)
    schedules = [
        (7, "weekly", 2),
        (30, "monthly", 7),
        (91, "quarterly", 14),
        (365, "annual", 31),
    ]
    for key, candidates in recurring_groups.items():
        if len(candidates) < 3 or not key[-1]:
            continue
        candidates.sort(key=_row_date)
        intervals = [
            (
                _row_date(candidates[index]) - _row_date(candidates[index - 1])
            ).days
            for index in range(1, len(candidates))
        ]
        typical = sorted(intervals)[len(intervals) // 2]
        schedule = next(
            (
                name
                for days, name, tolerance in schedules
                if abs(typical - days) <= tolerance
            ),
            None,
        )
        values = [
            Decimal(str(item["converted_amount"])) for item in candidates
        ]
        average = sum(values, Decimal("0")) / len(values)
        stable = average == 0 or max(
            abs(value - average) for value in values
        ) <= abs(average) * Decimal("0.10")
        if schedule and stable:
            fingerprint = _insight_fingerprint("recurring", key)
            if ("recurring", fingerprint) not in dismissed:
                recurring.append(
                    {
                        "type": "recurring",
                        "fingerprint": fingerprint,
                        "transaction_ids": [item["id"] for item in candidates],
                        "transactions": candidates,
                        "schedule": schedule,
                        "confidence": "high",
                        "reason": f"{len(candidates)} similarly sized transactions recur approximately {schedule}.",
                    }
                )
    uncategorized = [
        row["id"]
        for row in rows
        if row["transaction_type"] in ("income", "expense")
        and not row.get("category")
    ]
    expenses = [row for row in rows if row["transaction_type"] == "expense"]
    threshold = (
        (
            sum(Decimal(str(row["converted_amount"])) for row in expenses)
            / len(expenses)
            * 2
        )
        if expenses
        else Decimal("0")
    )
    unusual = [
        row["id"]
        for row in expenses
        if Decimal(str(row["converted_amount"])) > threshold
    ]
    return Response(
        {
            "duplicates": duplicates,
            "recurring": recurring,
            "uncategorized_transaction_ids": uncategorized,
            "unusually_large_expense_ids": unusual,
        }
    )


@api_view(["POST"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def dismiss_search_insight(request):
    insight_type = request.data.get("type")
    fingerprint = str(request.data.get("fingerprint", ""))
    if (
        insight_type not in {"duplicate", "recurring"}
        or len(fingerprint) != 64
    ):
        return Response(
            {"error": "A valid type and fingerprint are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    SearchInsightDismissal.objects.get_or_create(
        user=request.user, insight_type=insight_type, fingerprint=fingerprint
    )
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def bulk_transactions(request):
    ids = request.data.get("ids", [])
    action = request.data.get("action")
    if (
        not isinstance(ids, list)
        or not ids
        or action
        not in {
            "add_tags",
            "remove_tags",
            "set_category",
            "apply_drafts",
            "set_pinned",
        }
    ):
        return Response(
            {"error": "Valid ids and action are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        ids = [int(identifier) for identifier in ids]
    except (TypeError, ValueError):
        return Response(
            {"error": "ids must contain integers."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    transactions = list(
        _transaction_queryset(request.user, include_drafts=True)
        .filter(id__in=ids)
        .select_for_update()
    )
    if len(transactions) != len(set(ids)):
        return Response(
            {"error": "One or more transactions were not found."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        with db_transaction.atomic():
            if action in {"add_tags", "remove_tags"}:
                tag_ids = request.data.get("tag_ids", [])
                tags = list(Tag.objects.filter(id__in=tag_ids))
                if len(tags) != len(set(tag_ids)):
                    raise ValueError("One or more tags were not found.")
                for txn in transactions:
                    getattr(
                        txn.tags, "add" if action == "add_tags" else "remove"
                    )(*tags)
            elif action == "set_category":
                category = TransactionCategory.objects.get(
                    pk=int(request.data.get("category_id"))
                )
                if any(
                    txn.transaction_type not in ("income", "expense")
                    for txn in transactions
                ):
                    raise ValueError(
                        "Categories can only be assigned to income and expense transactions."
                    )
                expected = (
                    0
                    if all(
                        txn.transaction_type == "income"
                        for txn in transactions
                    )
                    else (
                        1
                        if all(
                            txn.transaction_type == "expense"
                            for txn in transactions
                        )
                        else None
                    )
                )
                if expected is None or category.category_type != expected:
                    raise ValueError(
                        "The category is incompatible with the selected transactions."
                    )
                for txn in transactions:
                    detail = (
                        txn.income_detail
                        if txn.transaction_type == "income"
                        else txn.expense_detail
                    )
                    detail.category = category
                    detail.save(update_fields=["category"])
                    txn.category = category
                    txn.save(update_fields=["category"])
            elif action == "apply_drafts":
                if any(not txn.is_draft for txn in transactions):
                    raise ValueError(
                        "All selected transactions must be drafts."
                    )
                for txn in transactions:
                    _apply_draft_transaction(txn)
            else:
                pinned = request.data.get("pinned")
                if not isinstance(pinned, bool):
                    raise ValueError("pinned must be a boolean.")
                Transaction.objects.filter(
                    id__in=ids, user=request.user
                ).update(pinned=pinned)
    except (ValueError, TransactionCategory.DoesNotExist, TypeError) as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )
    return Response({"updated": len(transactions)})


@api_view(["GET", "POST"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def export_search(request):
    try:
        if request.method == "POST" and request.data.get("ids"):
            ids = [int(identifier) for identifier in request.data["ids"]]
            transactions = list(
                _transaction_queryset(
                    request.user, include_drafts=True
                ).filter(id__in=ids)
            )
            if len(transactions) != len(set(ids)):
                raise ValueError("One or more transactions were not found.")
            currency = request.data.get("currency", "EUR").upper()
            amounts = _converted_transaction_amounts(transactions, currency)
            raw_rows = TransactionReadSerializer(transactions, many=True).data
            rows = [
                _transaction_display(txn, dict(row), amount)
                for txn, row, amount in zip(transactions, raw_rows, amounts)
            ]
        else:
            rows = _build_search_dataset(request)["rows"]
    except (ValueError, MissingExchangeRate) as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "type",
            "date",
            "description",
            "amount",
            "currency",
            "converted_amount",
            "category",
            "from_account",
            "to_account",
            "tags",
            "draft",
            "pinned",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row["id"],
                row["transaction_type"],
                row["date"],
                row.get("description") or "",
                row["amount"],
                row["currency"],
                row["converted_amount"],
                row.get("category_name") or "",
                row.get("from_account_name") or "",
                row.get("to_account_name") or "",
                "; ".join(tag["name"] for tag in row.get("tags", [])),
                row["is_draft"],
                row["pinned"],
            ]
        )
    response = HttpResponse(
        output.getvalue(), content_type="text/csv; charset=utf-8"
    )
    response["Content-Disposition"] = (
        'attachment; filename="transaction-search.csv"'
    )
    return response


def _transaction_currency_code(txn):
    if txn.transaction_type == "income" and hasattr(txn, "income_detail"):
        return txn.income_detail.to_cash_balance.currency.code
    if txn.transaction_type == "expense" and hasattr(txn, "expense_detail"):
        return txn.expense_detail.from_cash_balance.currency.code
    if txn.transaction_type == "transfer" and hasattr(txn, "transfer_detail"):
        return txn.transfer_detail.from_cash_balance.currency.code
    if txn.transaction_type in ("buy", "sell") and hasattr(
        txn, "trade_detail"
    ):
        return txn.trade_detail.cash_balance.currency.code
    return "EUR"


def _transaction_amount(txn):
    if txn.transaction_type == "income" and hasattr(txn, "income_detail"):
        return _to_decimal(txn.income_detail.amount)
    if txn.transaction_type == "expense" and hasattr(txn, "expense_detail"):
        return _to_decimal(txn.expense_detail.amount)
    if txn.transaction_type == "transfer" and hasattr(txn, "transfer_detail"):
        return _to_decimal(txn.transfer_detail.amount)
    if txn.transaction_type in ("buy", "sell") and hasattr(
        txn, "trade_detail"
    ):
        return _to_decimal(txn.trade_detail.total_value)
    return Decimal("0")


def _cash_impact_amount(txn):
    if txn.transaction_type in ("income", "expense"):
        return _transaction_amount(txn)
    return Decimal("0")


def _append_converted_amounts(transactions, rows, currency):
    if not currency:
        return None

    currency = currency.upper()
    rate_cache = _preload_rate_cache(transactions, currency)
    for txn, row in zip(transactions, rows):
        try:
            converted = _convert_amount_cached(
                rate_cache,
                _transaction_amount(txn),
                _transaction_currency_code(txn),
                currency,
                txn.date,
            )
        except MissingExchangeRate as exc:
            return str(exc)

        row["converted_amount"] = float(_round_2_decimal(converted))
        row["converted_currency"] = currency

    return None


def _preload_rate_cache(transactions, reporting_currency):
    needed_currencies = {reporting_currency.upper()}
    needed_dates = set()
    for txn in transactions:
        needed_currencies.add(_transaction_currency_code(txn).upper())
        needed_dates.add(txn.date)

    if not needed_dates:
        return {}

    quote_currencies = needed_currencies - {USD}

    if not quote_currencies:
        return {}

    rates = (
        ExchangeRate.objects.filter(
            base_currency=USD,
            quote_currency__in=quote_currencies,
            date__lte=max(needed_dates),
            provider=ExchangeRate.PROVIDER_FRANKFURTER,
        )
        .order_by("quote_currency", "date")
        .values_list("quote_currency", "date", "rate")
    )

    by_currency = defaultdict(list)
    for quote_currency, rate_date, rate in rates:
        by_currency[quote_currency].append((rate_date, rate))

    rate_cache = {}
    for quote_currency, rows in by_currency.items():
        index = 0
        latest_rate = None
        for rate_date in sorted(needed_dates):
            while index < len(rows) and rows[index][0] <= rate_date:
                latest_rate = rows[index][1]
                index += 1
            if latest_rate is not None:
                rate_cache[(rate_date, quote_currency)] = latest_rate

    return rate_cache


def _usd_quote_rate_cached(rate_cache, target_date, quote_currency):
    quote_currency = quote_currency.upper()
    if quote_currency == USD:
        return Decimal("1")

    key = (target_date, quote_currency)
    if key not in rate_cache:
        raise MissingExchangeRate(
            f"Missing USD/{quote_currency} rate on or before {target_date}"
        )

    return rate_cache[key]


def _convert_amount_cached(
    rate_cache, amount, from_currency, to_currency, target_date
):
    amount = _to_decimal(amount)
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    if from_currency == to_currency:
        return amount
    if from_currency == EUR and to_currency == BGN:
        return amount * EUR_BGN_RATE
    if from_currency == BGN and to_currency == EUR:
        return amount / EUR_BGN_RATE

    from_usd_rate = _usd_quote_rate_cached(
        rate_cache, target_date, from_currency
    )
    to_usd_rate = _usd_quote_rate_cached(rate_cache, target_date, to_currency)
    return amount / from_usd_rate * to_usd_rate


def _holding_value(holding):
    latest_price = holding.security.prices.first()
    price = latest_price.price if latest_price else holding.average_cost
    return _to_decimal(holding.quantity) * _to_decimal(price)


def _transaction_category_name(txn):
    if txn.transaction_type == "income" and hasattr(txn, "income_detail"):
        category = txn.income_detail.category
        return category.category if category else "Uncategorized"
    if txn.transaction_type == "expense" and hasattr(txn, "expense_detail"):
        category = txn.expense_detail.category
        return category.category if category else "Uncategorized"
    return "Uncategorized"


def _converted_transaction_amounts(transactions, currency):
    rate_cache = _preload_rate_cache(transactions, currency)
    converted = []
    for txn in transactions:
        converted.append(
            _convert_amount_cached(
                rate_cache,
                _transaction_amount(txn),
                _transaction_currency_code(txn),
                currency,
                txn.date,
            )
        )
    return converted


def _build_sankey_payload(current_month_transactions, currency):
    amounts = _converted_transaction_amounts(
        current_month_transactions, currency
    )
    income_categories = defaultdict(Decimal)
    expense_categories = defaultdict(Decimal)

    for txn, amount in zip(current_month_transactions, amounts):
        category = _transaction_category_name(txn)
        if txn.transaction_type == "income":
            income_categories[category] += amount
        elif txn.transaction_type == "expense":
            expense_categories[category] += amount

    nodes = [{"name": "Income", "color": "green"}]
    links = []
    total_income = sum(income_categories.values(), Decimal("0"))
    total_expense = sum(expense_categories.values(), Decimal("0"))

    for category, amount in sorted(income_categories.items()):
        if amount == 0:
            continue
        nodes.append(
            {
                "name": "Other " if category == "Other" else category,
                "color": "#90ee90",
            }
        )
        links.append(
            {
                "source": len(nodes) - 1,
                "target": 0,
                "value": float(_round_2_decimal(amount)),
            }
        )

    for category, amount in sorted(expense_categories.items()):
        if amount == 0:
            continue
        nodes.append({"name": category, "color": "#800000"})
        links.append(
            {
                "source": 0,
                "target": len(nodes) - 1,
                "value": float(_round_2_decimal(amount)),
            }
        )

    nodes.append({"name": "Savings", "color": "#0080FF"})
    links.append(
        {
            "source": 0,
            "target": len(nodes) - 1,
            "value": float(_round_2_decimal(total_income - total_expense)),
        }
    )
    return {"nodes": nodes, "links": links}


def _build_income_vs_expense_payload(transactions, currency):
    amounts = _converted_transaction_amounts(transactions, currency)
    grouped = defaultdict(
        lambda: {"income": Decimal("0"), "expense": Decimal("0")}
    )

    for txn, amount in zip(transactions, amounts):
        month = txn.date.strftime("%Y-%m")
        if txn.transaction_type == "income":
            grouped[month]["income"] += amount
        elif txn.transaction_type == "expense":
            grouped[month]["expense"] += amount

    return [
        {
            "date": month,
            "income": float(_round_2_decimal(values["income"])),
            "expense": float(_round_2_decimal(values["expense"])),
        }
        for month, values in sorted(grouped.items())
    ]


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_profile_stats(request):
    currency = request.GET.get("currency", "EUR").upper()
    today = date.today()
    current_month_start = today.replace(day=1)
    # Income vs expense chart shows data since January 2023.
    income_vs_expense_start = date(2023, 1, 1)

    base_queryset = (
        Transaction.objects.filter(
            user=request.user,
            transaction_type__in=("income", "expense"),
            is_draft=False,
        )
        .select_related(
            "income_detail__to_cash_balance__currency",
            "income_detail__category",
            "expense_detail__from_cash_balance__currency",
            "expense_detail__category",
        )
        .order_by("date")
    )
    current_month_transactions = list(
        base_queryset.filter(date__gte=current_month_start, date__lte=today)
    )
    recent_transactions = list(
        base_queryset.filter(date__gte=income_vs_expense_start)
    )

    try:
        payload = {
            "currency": currency,
            "monthly_finances_sankey": _build_sankey_payload(
                current_month_transactions, currency
            ),
            "income_vs_expense": _build_income_vs_expense_payload(
                recent_transactions, currency
            ),
        }
    except MissingExchangeRate as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )

    return Response(payload, status=status.HTTP_200_OK)


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_wealth_stats(request):
    user = request.user
    currency = request.GET.get("currency", "EUR").upper()
    try:
        latest_rate_date = get_latest_rate_date()
    except MissingExchangeRate as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )

    balances = CashBalance.objects.filter(account__user=user).select_related(
        "currency"
    )
    try:
        current_total_wealth = sum(
            convert_amount(
                balance.balance,
                balance.currency.code,
                currency,
                latest_rate_date,
            )
            for balance in balances
        )

        holdings = (
            Holding.objects.filter(account__user=user)
            .select_related("security__currency")
            .prefetch_related("security__prices")
        )
        current_total_wealth += sum(
            convert_amount(
                _holding_value(holding),
                holding.security.currency.code,
                currency,
                latest_rate_date,
            )
            for holding in holdings
        )
    except MissingExchangeRate as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )

    transactions = (
        Transaction.objects.filter(
            user=user,
            transaction_type__in=("income", "expense"),
            is_draft=False,
            date__gte=date(2023, 1, 1),
        )
        .select_related(
            "income_detail__to_cash_balance__currency",
            "expense_detail__from_cash_balance__currency",
        )
        .order_by("-date")
    )

    grouped = defaultdict(
        lambda: {"incomes": Decimal("0"), "expenses": Decimal("0")}
    )
    for txn in transactions:
        year_month = txn.date.strftime("%Y-%m")
        amount = _cash_impact_amount(txn)
        code = _transaction_currency_code(txn)
        try:
            converted = convert_amount(amount, code, currency, txn.date)
        except MissingExchangeRate as exc:
            return Response(
                {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
            )
        grouped[year_month][f"{txn.transaction_type}s"] += converted

    sorted_months = sorted(grouped.keys(), reverse=True)
    rolling_wealth = current_total_wealth
    monthly_differences = []

    for year_month in sorted_months:
        net = grouped[year_month]["incomes"] - grouped[year_month]["expenses"]
        monthly_differences.append(
            {
                "date": year_month,
                "net_difference": float(_round_2_decimal(net)),
                "monthly_wealth": float(
                    _round_2_decimal(max(rolling_wealth, Decimal("0")))
                ),
            }
        )
        rolling_wealth -= net

    monthly_differences.reverse()
    return Response({"monthly_differences": monthly_differences})


@api_view(["PUT"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def update_transaction(request, pk):
    try:
        txn = Transaction.objects.select_related(
            "income_detail__to_cash_balance",
            "expense_detail__from_cash_balance",
            "transfer_detail__from_cash_balance",
            "transfer_detail__to_cash_balance",
            "trade_detail__holding",
            "trade_detail__cash_balance",
            "trade_detail__tangible_asset",
        ).get(pk=pk, user=request.user)
    except Transaction.DoesNotExist:
        return Response(
            {"error": "Transaction not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    serializer = TransactionWriteSerializer(
        data=request.data,
        context={"user": request.user},
    )
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    tx_type = data["resolved_type"]
    if tx_type != txn.transaction_type:
        return Response(
            {"error": "Transaction type cannot be changed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    description = data.get("description", "")
    tx_date = data["date"]
    tags = data["resolved_tags"]

    try:
        with db_transaction.atomic():
            if tx_type == "income":
                old_detail = txn.income_detail
                new_amount = data["resolved_amount"]
                new_cash_balance = data["resolved_to_cash_balance"]
                new_category = data.get("resolved_category")

                _apply_cash_delta(
                    old_detail.to_cash_balance, -old_detail.amount
                )

                txn.date = tx_date
                txn.description = description
                txn.amount = new_amount
                txn.category = new_category
                txn.to_account = new_cash_balance.account
                txn.save(
                    update_fields=[
                        "date",
                        "description",
                        "amount",
                        "category",
                        "to_account",
                    ]
                )

                old_detail.to_cash_balance = new_cash_balance
                old_detail.amount = new_amount
                old_detail.category = new_category
                old_detail.save(
                    update_fields=["to_cash_balance", "amount", "category"]
                )

                _apply_cash_delta(new_cash_balance, new_amount)

            elif tx_type == "expense":
                old_detail = txn.expense_detail
                new_amount = data["resolved_amount"]
                new_cash_balance = data["resolved_from_cash_balance"]
                new_category = data.get("resolved_category")

                _apply_cash_delta(
                    old_detail.from_cash_balance, old_detail.amount
                )

                txn.date = tx_date
                txn.description = description
                txn.amount = new_amount
                txn.category = new_category
                txn.from_account = new_cash_balance.account
                txn.save(
                    update_fields=[
                        "date",
                        "description",
                        "amount",
                        "category",
                        "from_account",
                    ]
                )

                old_detail.from_cash_balance = new_cash_balance
                old_detail.amount = new_amount
                old_detail.category = new_category
                old_detail.save(
                    update_fields=["from_cash_balance", "amount", "category"]
                )

                _apply_cash_delta(new_cash_balance, -new_amount)

            elif tx_type == "transfer":
                old_detail = txn.transfer_detail
                new_from_amount = data["resolved_from_amount"]
                new_fx_rate = data["resolved_fx_rate"]
                new_from_cb = data["resolved_from_cash_balance"]
                new_to_cb = data["resolved_to_cash_balance"]
                new_credited = new_from_amount * new_fx_rate
                old_credited = old_detail.amount * old_detail.fx_rate

                _apply_cash_delta(
                    old_detail.from_cash_balance, old_detail.amount
                )
                _apply_cash_delta(old_detail.to_cash_balance, -old_credited)

                txn.date = tx_date
                txn.description = description
                txn.amount = new_from_amount
                txn.from_account = new_from_cb.account
                txn.to_account = new_to_cb.account
                txn.save(
                    update_fields=[
                        "date",
                        "description",
                        "amount",
                        "from_account",
                        "to_account",
                    ]
                )

                old_detail.from_cash_balance = new_from_cb
                old_detail.to_cash_balance = new_to_cb
                old_detail.amount = new_from_amount
                old_detail.fx_rate = new_fx_rate
                old_detail.save(
                    update_fields=[
                        "from_cash_balance",
                        "to_cash_balance",
                        "amount",
                        "fx_rate",
                    ]
                )

                _apply_cash_delta(new_from_cb, -new_from_amount)
                _apply_cash_delta(new_to_cb, new_credited)

            else:
                raise ValueError(f"Unsupported transaction type: {tx_type}")

            if tags:
                txn.tags.set(tags)
            else:
                txn.tags.clear()

            txn.refresh_from_db()

        return Response(
            TransactionReadSerializer(txn).data,
            status=status.HTTP_200_OK,
        )

    except ValueError as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )
