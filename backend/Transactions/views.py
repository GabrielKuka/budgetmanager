from collections import defaultdict
from datetime import datetime
from decimal import Decimal

import requests
from django.db import transaction as db_transaction
from django.db.models import F, Q
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

from Accounts.models import CashBalance, Holding

from .models import (
    ExpenseDetail,
    IncomeDetail,
    SecurityTradeDetail,
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
    user, transaction_type=None, from_date=None, to_date=None
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
            "security_trade_detail__security",
            "security_trade_detail__holding",
            "security_trade_detail__cash_balance__account",
            "security_trade_detail__cash_balance__currency",
        )
        .prefetch_related("tags")
        .order_by("-date", "-id")
    )

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
            detail = txn.security_trade_detail
            total = detail.total_value
            _apply_cash_delta(detail.cash_balance, total)
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
            detail = txn.security_trade_detail
            total = detail.total_value
            _apply_cash_delta(detail.cash_balance, -total)
            if detail.holding_id:
                holding = Holding.objects.select_for_update().get(
                    pk=detail.holding_id
                )
                _update_holding_for_sell_reversal(holding, detail.quantity)

        txn.delete()


def convert_currency(source, targets):
    rates = {}
    for target in targets:
        if source == target:
            rates[target] = 1
            continue

        response = requests.get(
            "https://wise.com/rates/history",
            params={
                "source": source,
                "target": target,
                "length": "1",
                "unit": "hour",
                "resolution": "hourly",
            },
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
        rates[target] = float(payload[0]["value"]) if payload else 1

    if not rates:
        raise ValueError("No rates returned.")
    return rates


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

    try:
        with db_transaction.atomic():
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
                )
                IncomeDetail.objects.create(
                    transaction=txn,
                    to_cash_balance=to_cash_balance,
                    amount=amount,
                    category=category,
                )
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
                )
                ExpenseDetail.objects.create(
                    transaction=txn,
                    from_cash_balance=from_cash_balance,
                    amount=amount,
                    category=category,
                )
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
                )
                TransferDetail.objects.create(
                    transaction=txn,
                    from_cash_balance=from_cash_balance,
                    to_cash_balance=to_cash_balance,
                    amount=from_amount,
                    fx_rate=fx_rate,
                )
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
                )
                SecurityTradeDetail.objects.create(
                    transaction=txn,
                    security=security,
                    holding=holding,
                    cash_balance=from_cash_balance,
                    quantity=quantity,
                    price_per_unit=price_per_unit,
                )
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
                )
                SecurityTradeDetail.objects.create(
                    transaction=txn,
                    security=holding.security,
                    holding=holding,
                    cash_balance=to_cash_balance,
                    quantity=quantity,
                    price_per_unit=price_per_unit,
                )
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
            "security_trade_detail__holding",
            "security_trade_detail__cash_balance",
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
            "security_trade_detail__holding",
            "security_trade_detail__cash_balance",
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

    queryset = _transaction_queryset(
        request.user,
        transaction_type=None,
        from_date=from_date,
        to_date=to_date,
    )
    rows = TransactionReadSerializer(queryset, many=True).data
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
    queryset = _transaction_queryset(
        request.user, "expense", from_date, to_date
    )
    return Response(TransactionReadSerializer(queryset, many=True).data)


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
    queryset = _transaction_queryset(
        request.user, "income", from_date, to_date
    )
    return Response(TransactionReadSerializer(queryset, many=True).data)


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
    queryset = _transaction_queryset(
        request.user, "transfer", from_date, to_date
    )
    return Response(TransactionReadSerializer(queryset, many=True).data)


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
    query = request.GET.get("query", "").strip()
    if not query:
        return Response(
            {"error": "query parameter is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    transactions = (
        Transaction.objects.filter(user=request.user)
        .filter(
            Q(income_detail__category__category__iexact=query)
            | Q(expense_detail__category__category__iexact=query)
            | Q(security_trade_detail__security__ticker__iexact=query)
            | Q(security_trade_detail__security__name__icontains=query)
            | Q(description__icontains=query)
            | Q(tags__name__iexact=query)
        )
        .distinct()
    )
    rows = TransactionReadSerializer(transactions, many=True).data
    return Response(
        _group_transactions_by_type(rows), status=status.HTTP_200_OK
    )


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_food_stats(request):
    user = request.user
    currency = request.GET.get("currency", "EUR")
    rates = convert_currency(currency, ["EUR", "USD", "BGN", "GBP", "ALL"])

    food_transactions = (
        Transaction.objects.filter(
            user=user,
            transaction_type="expense",
            expense_detail__category__category__iexact="Food",
        )
        .values(
            "id",
            "date",
            "description",
            "tags__name",
            amount=F("expense_detail__amount"),
            currency_code=F(
                "expense_detail__from_cash_balance__currency__code"
            ),
        )
        .order_by("-date", "-id")
    )

    aggregated = defaultdict(lambda: {"tags": []})
    for row in food_transactions:
        transaction_id = row["id"]
        code = row["currency_code"] or "EUR"
        if "id" not in aggregated[transaction_id]:
            aggregated[transaction_id].update(
                {
                    "id": row["id"],
                    "date": row["date"],
                    "amount": float(row["amount"]) / rates.get(code, 1),
                    "description": row["description"],
                }
            )
        if row["tags__name"]:
            aggregated[transaction_id]["tags"].append(row["tags__name"])

    grouped_by_month = defaultdict(
        lambda: {
            "transactions": [],
            "total_amount": 0,
            "kaufland_sum": 0,
            "billa_sum": 0,
            "lidl_sum": 0,
        }
    )
    for item in aggregated.values():
        year_month = item["date"].strftime("%Y-%m")
        description = (item["description"] or "").lower()
        grouped_by_month[year_month]["transactions"].append(item)
        grouped_by_month[year_month]["total_amount"] += item["amount"]
        if "kaufland" in description:
            grouped_by_month[year_month]["kaufland_sum"] += item["amount"]
        if "lidl" in description:
            grouped_by_month[year_month]["lidl_sum"] += item["amount"]
        if "billa" in description:
            grouped_by_month[year_month]["billa_sum"] += item["amount"]

    response = []
    for year_month, data in grouped_by_month.items():
        response.append(
            {
                "year_month": year_month,
                "total_amount": round(data["total_amount"], 2),
                "kaufland": round(data["kaufland_sum"], 2),
                "lidl": round(data["lidl_sum"], 2),
                "billa": round(data["billa_sum"], 2),
                "others": round(
                    data["total_amount"]
                    - data["kaufland_sum"]
                    - data["lidl_sum"]
                    - data["billa_sum"],
                    2,
                ),
                "transactions": data["transactions"],
            }
        )

    return Response({"data": response}, status=status.HTTP_200_OK)


def _transaction_currency_code(txn):
    if txn.transaction_type == "income" and hasattr(txn, "income_detail"):
        return txn.income_detail.to_cash_balance.currency.code
    if txn.transaction_type == "expense" and hasattr(txn, "expense_detail"):
        return txn.expense_detail.from_cash_balance.currency.code
    if txn.transaction_type == "transfer" and hasattr(txn, "transfer_detail"):
        return txn.transfer_detail.from_cash_balance.currency.code
    if txn.transaction_type in ("buy", "sell") and hasattr(
        txn, "security_trade_detail"
    ):
        return txn.security_trade_detail.cash_balance.currency.code
    return "EUR"


def _cash_impact_amount(txn):
    if txn.transaction_type == "income" and hasattr(txn, "income_detail"):
        return _to_decimal(txn.income_detail.amount)
    if txn.transaction_type == "expense" and hasattr(txn, "expense_detail"):
        return _to_decimal(txn.expense_detail.amount)
    return Decimal("0")


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_wealth_stats(request):
    user = request.user
    currency = request.GET.get("currency", "EUR")
    rates = convert_currency(currency, ["EUR", "USD", "BGN", "GBP", "ALL"])

    balances = CashBalance.objects.filter(account__user=user).select_related(
        "currency"
    )
    current_total_wealth = sum(
        float(balance.balance) / rates.get(balance.currency.code, 1)
        for balance in balances
    )

    transactions = (
        Transaction.objects.filter(
            user=user, transaction_type__in=("income", "expense")
        )
        .select_related(
            "income_detail__to_cash_balance__currency",
            "expense_detail__from_cash_balance__currency",
        )
        .order_by("-date")
    )

    grouped = defaultdict(lambda: {"incomes": 0.0, "expenses": 0.0})
    for txn in transactions:
        year_month = txn.date.strftime("%Y-%m")
        amount = float(_cash_impact_amount(txn))
        code = _transaction_currency_code(txn)
        converted = amount / rates.get(code, 1)
        grouped[year_month][f"{txn.transaction_type}s"] += converted

    sorted_months = sorted(grouped.keys(), reverse=True)
    rolling_wealth = current_total_wealth
    monthly_differences = []

    for year_month in sorted_months:
        net = grouped[year_month]["incomes"] - grouped[year_month]["expenses"]
        monthly_differences.append(
            {
                "date": year_month,
                "net_difference": round(net, 2),
                "monthly_wealth": round(rolling_wealth, 2),
            }
        )
        rolling_wealth -= net

    monthly_differences.reverse()
    return Response({"monthly_differences": monthly_differences})
