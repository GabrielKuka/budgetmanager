from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

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


def _transaction_queryset(user, transaction_type=None, from_date=None, to_date=None):
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
        "incomes": [row for row in rows if row["transaction_type"] == "income"],
        "expenses": [row for row in rows if row["transaction_type"] == "expense"],
        "transfers": [row for row in rows if row["transaction_type"] == "transfer"],
        "buys": [row for row in rows if row["transaction_type"] == "buy"],
        "sells": [row for row in rows if row["transaction_type"] == "sell"],
    }


def _apply_cash_delta(cash_balance, delta):
    CashBalance.objects.filter(pk=cash_balance.pk).update(balance=F("balance") + delta)
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
        raise ValueError(f"Cannot sell {quantity}; holding has only {old_qty}.")
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
                holding = Holding.objects.select_for_update().get(pk=detail.holding_id)
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
                holding = Holding.objects.select_for_update().get(pk=detail.holding_id)
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
                    if provided_holding.account_id != from_cash_balance.account_id:
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
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


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
    return Response({"message": "Transaction deleted."}, status=status.HTTP_200_OK)


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
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    queryset = _transaction_queryset(
        request.user,
        transaction_type=None,
        from_date=from_date,
        to_date=to_date,
    )
    transactions = list(queryset)
    rows = TransactionReadSerializer(transactions, many=True).data
    error = _append_converted_amounts(transactions, rows, request.GET.get("currency"))
    if error:
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
    return Response(_group_transactions_by_type(rows), status=status.HTTP_200_OK)


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_expenses(request):
    try:
        from_date, to_date = _parse_date_range(request)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    queryset = _transaction_queryset(request.user, "expense", from_date, to_date)
    return Response(TransactionReadSerializer(queryset, many=True).data)


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_incomes(request):
    try:
        from_date, to_date = _parse_date_range(request)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    queryset = _transaction_queryset(request.user, "income", from_date, to_date)
    return Response(TransactionReadSerializer(queryset, many=True).data)


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_transfers(request):
    try:
        from_date, to_date = _parse_date_range(request)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    queryset = _transaction_queryset(request.user, "transfer", from_date, to_date)
    return Response(TransactionReadSerializer(queryset, many=True).data)


@api_view(["GET"])
@authentication_classes([FlexibleTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_all_transactions(request):
    queryset = _transaction_queryset(request.user)
    rows = TransactionReadSerializer(queryset, many=True).data
    return Response(_group_transactions_by_type(rows), status=status.HTTP_200_OK)


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
    queryset = TransactionCategory.objects.filter(category_type=0).order_by("category")
    return Response(TransactionCategorySerializer(queryset, many=True).data)


@api_view(["GET"])
def get_expense_categories(request):
    queryset = TransactionCategory.objects.filter(category_type=1).order_by("category")
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
    return Response(_group_transactions_by_type(rows), status=status.HTTP_200_OK)


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


def _transaction_amount(txn):
    if txn.transaction_type == "income" and hasattr(txn, "income_detail"):
        return _to_decimal(txn.income_detail.amount)
    if txn.transaction_type == "expense" and hasattr(txn, "expense_detail"):
        return _to_decimal(txn.expense_detail.amount)
    if txn.transaction_type == "transfer" and hasattr(txn, "transfer_detail"):
        return _to_decimal(txn.transfer_detail.amount)
    if txn.transaction_type in ("buy", "sell") and hasattr(
        txn, "security_trade_detail"
    ):
        return _to_decimal(txn.security_trade_detail.total_value)
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


def _convert_amount_cached(rate_cache, amount, from_currency, to_currency, target_date):
    amount = _to_decimal(amount)
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    if from_currency == to_currency:
        return amount
    if from_currency == EUR and to_currency == BGN:
        return amount * EUR_BGN_RATE
    if from_currency == BGN and to_currency == EUR:
        return amount / EUR_BGN_RATE

    from_usd_rate = _usd_quote_rate_cached(rate_cache, target_date, from_currency)
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
    amounts = _converted_transaction_amounts(current_month_transactions, currency)
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
    grouped = defaultdict(lambda: {"income": Decimal("0"), "expense": Decimal("0")})

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
    twelve_months_ago = today - timedelta(days=365)

    base_queryset = (
        Transaction.objects.filter(
            user=request.user,
            transaction_type__in=("income", "expense"),
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
    recent_transactions = list(base_queryset.filter(date__gte=twelve_months_ago))

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
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

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
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    balances = CashBalance.objects.filter(account__user=user).select_related("currency")
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
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    transactions = (
        Transaction.objects.filter(
            user=user,
            transaction_type__in=("income", "expense"),
            date__gte=date(2023, 1, 1),
        )
        .select_related(
            "income_detail__to_cash_balance__currency",
            "expense_detail__from_cash_balance__currency",
        )
        .order_by("-date")
    )

    grouped = defaultdict(lambda: {"incomes": Decimal("0"), "expenses": Decimal("0")})
    for txn in transactions:
        year_month = txn.date.strftime("%Y-%m")
        amount = _cash_impact_amount(txn)
        code = _transaction_currency_code(txn)
        try:
            converted = convert_amount(amount, code, currency, txn.date)
        except MissingExchangeRate as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
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
