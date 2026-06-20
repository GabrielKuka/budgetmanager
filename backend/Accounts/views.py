from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction as db_transaction
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, Sum
from django.db.models.functions import TruncMonth
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from Currency.services import MissingExchangeRate, convert_amount
from Transactions.models import Transaction

from .models import Account, CashBalance, Currency, Security
from .serializers import AccountSerializer


def _to_decimal(value):
    if isinstance(value, Decimal):
        return value
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _round_2(value):
    return float(
        _to_decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    )


def _security_asset_class_label(value):
    return dict(Security.ASSET_CLASS_CHOICES).get(value, value)


def _security_structure_label(value):
    return dict(Security.STRUCTURE_CHOICES).get(value, value)


def _holding_value(holding):
    latest_price = holding.security.prices.first()
    if latest_price is not None:
        return _to_decimal(holding.quantity) * _to_decimal(latest_price.price)
    return _to_decimal(holding.quantity) * _to_decimal(holding.average_cost)


def _convert_cached(amount, from_currency, to_currency, conversion_rates):
    amount = _to_decimal(amount)
    from_currency = str(from_currency).upper()
    to_currency = str(to_currency).upper()

    if from_currency == to_currency:
        return amount

    key = (from_currency, to_currency)
    if key not in conversion_rates:
        conversion_rates[key] = convert_amount(
            Decimal("1"),
            from_currency,
            to_currency,
            None,
        )
    return amount * conversion_rates[key]


def _account_totals_payload(accounts, currency):
    currency = currency.upper()
    by_account = {}
    summary_cash = Decimal("0")
    summary_cash_balances = Decimal("0")
    summary_hard_cash = Decimal("0")
    summary_holdings = Decimal("0")
    summary_holdings_by_asset_class = {}
    conversion_rates = {}

    for account in accounts:
        cash_total = Decimal("0")
        holdings_total = Decimal("0")
        converted_cash_balances = Decimal("0")

        for balance in account.cash_balances.all():
            converted_balance = _convert_cached(
                balance.balance,
                balance.currency.code,
                currency,
                conversion_rates,
            )
            cash_total += converted_balance
            if account.type == 2:
                summary_hard_cash += converted_balance
            else:
                converted_cash_balances += converted_balance

        for holding in account.holdings.all():
            converted_holding = _convert_cached(
                _holding_value(holding),
                holding.security.currency.code,
                currency,
                conversion_rates,
            )
            holdings_total += converted_holding
            asset_class = holding.security.asset_class
            summary_holdings_by_asset_class[asset_class] = (
                summary_holdings_by_asset_class.get(asset_class, Decimal("0"))
                + converted_holding
            )

        total = cash_total + holdings_total
        summary_cash += cash_total
        summary_cash_balances += converted_cash_balances
        summary_holdings += holdings_total
        by_account[str(account.id)] = {
            "cash_total": _round_2(cash_total),
            "holdings_total": _round_2(holdings_total),
            "total": _round_2(total),
        }

    return {
        "currency": currency,
        "summary": {
            "cash": _round_2(summary_cash),
            "cash_breakdown": {
                "cash_balances": _round_2(summary_cash_balances),
                "hard_cash": _round_2(summary_hard_cash),
            },
            "investments": _round_2(summary_holdings),
            "investments_by_asset_class": [
                {
                    "asset_class": asset_class,
                    "label": _security_asset_class_label(asset_class),
                    "amount": _round_2(amount),
                }
                for asset_class, amount in sorted(
                    summary_holdings_by_asset_class.items()
                )
            ],
            "total_assets": _round_2(summary_cash + summary_holdings),
        },
        "accounts": by_account,
    }


def _summarize_rows(rows):
    ordered_rows = sorted(rows, key=lambda row: row["date"])
    amounts = [
        _to_decimal(row.get("amount", row.get("calc_amount", 0)))
        for row in ordered_rows
    ]

    if not amounts:
        return {
            "total": 0.0,
            "average": 0.0,
            "max": 0.0,
            "min": 0.0,
            "count": 0,
            "running_total": [],
            "moving_avg": [],
        }

    total = sum(amounts, Decimal("0"))
    running_total = []
    moving_avg = []
    rolling = []
    cumulative = Decimal("0")

    for row, amount in zip(ordered_rows, amounts):
        cumulative += amount
        running_total.append(
            {
                "date": row["date"],
                "amount": _round_2(amount),
                "running_total": _round_2(cumulative),
            }
        )

        rolling.append(amount)
        if len(rolling) > 7:
            rolling.pop(0)
        avg = sum(rolling, Decimal("0")) / Decimal(len(rolling))
        moving_avg.append(
            {
                "date": row["date"],
                "amount": _round_2(amount),
                "moving_avg": _round_2(avg),
            }
        )

    return {
        "total": _round_2(total),
        "average": _round_2(total / len(amounts)),
        "max": _round_2(max(amounts)),
        "min": _round_2(min(amounts)),
        "count": len(amounts),
        "running_total": running_total,
        "moving_avg": moving_avg,
    }


def _allocation_percent(amount, total):
    amount = _to_decimal(amount)
    total = _to_decimal(total)
    if total <= 0:
        return 0.0
    return _round_2((amount * Decimal("100")) / total)


def _account_activity_payload(user, account):
    transactions_by_month = list(
        Transaction.objects.filter(is_draft=False, user=user)
        .filter(
            Q(
                transaction_type="income",
                income_detail__to_cash_balance__account=account,
            )
            | Q(
                transaction_type="expense",
                expense_detail__from_cash_balance__account=account,
            )
            | Q(
                transaction_type="transfer",
                transfer_detail__from_cash_balance__account=account,
            )
            | Q(
                transaction_type="transfer",
                transfer_detail__to_cash_balance__account=account,
            )
            | Q(
                transaction_type__in=("buy", "sell"),
                security_trade_detail__cash_balance__account=account,
            )
        )
        .distinct()
        .annotate(month_year=TruncMonth("date"))
        .values("month_year")
        .annotate(
            income_count=Count("id", filter=Q(transaction_type="income")),
            expense_count=Count("id", filter=Q(transaction_type="expense")),
            transfer_count=Count("id", filter=Q(transaction_type="transfer")),
            buy_count=Count("id", filter=Q(transaction_type="buy")),
            sell_count=Count("id", filter=Q(transaction_type="sell")),
        )
        .order_by("month_year")
    )

    return {"transactions_by_month": transactions_by_month}


def _account_overview_payload(account, user, currency):
    currency = currency.upper()
    conversion_rates = {}
    cash_rows = []
    holding_rows = []
    cash_total = Decimal("0")
    holdings_total = Decimal("0")
    holdings_by_asset_class = {}
    holdings_by_security = []
    cash_native_for_labels = []

    for balance in account.cash_balances.all():
        converted_value = _convert_cached(
            balance.balance,
            balance.currency.code,
            currency,
            conversion_rates,
        )
        cash_total += converted_value
        row = {
            "id": balance.id,
            "currency": {
                "id": balance.currency.id,
                "code": balance.currency.code,
                "name": balance.currency.name,
                "symbol": balance.currency.symbol,
            },
            "balance": _round_2(balance.balance),
            "converted_value": _round_2(converted_value),
            "updated_on": balance.updated_on,
        }
        cash_rows.append(row)
        cash_native_for_labels.append(
            f"{balance.currency.code} {row['balance']}"
        )

    for holding in account.holdings.all():
        security = holding.security
        latest_price = security.prices.first()
        price_missing = latest_price is None
        native_market_value = _holding_value(holding)
        converted_market_value = _convert_cached(
            native_market_value,
            security.currency.code,
            currency,
            conversion_rates,
        )
        native_cost_basis = _to_decimal(holding.cost_basis)
        converted_cost_basis = _convert_cached(
            native_cost_basis,
            security.currency.code,
            currency,
            conversion_rates,
        )
        converted_unrealized_gain = (
            converted_market_value - converted_cost_basis
        )
        holdings_total += converted_market_value
        asset_class = security.asset_class
        holdings_by_asset_class[asset_class] = (
            holdings_by_asset_class.get(asset_class, Decimal("0"))
            + converted_market_value
        )
        holdings_by_security.append(
            {
                "security_id": security.id,
                "ticker": security.ticker,
                "name": security.name,
                "amount": _round_2(converted_market_value),
            }
        )
        holding_rows.append(
            {
                "id": holding.id,
                "security": {
                    "id": security.id,
                    "ticker": security.ticker,
                    "name": security.name,
                    "isin": security.isin,
                    "asset_class": security.asset_class,
                    "asset_class_label": _security_asset_class_label(
                        security.asset_class
                    ),
                    "structure": security.structure,
                    "structure_label": _security_structure_label(
                        security.structure
                    ),
                    "currency": {
                        "id": security.currency.id,
                        "code": security.currency.code,
                        "symbol": security.currency.symbol,
                    },
                },
                "quantity": _round_2(holding.quantity),
                "average_cost": _round_2(holding.average_cost),
                "cost_basis": _round_2(native_cost_basis),
                "converted_cost_basis": _round_2(converted_cost_basis),
                "latest_price": (
                    {
                        "date": latest_price.date,
                        "price": _round_2(latest_price.price),
                        "source": latest_price.source,
                    }
                    if latest_price
                    else None
                ),
                "price_missing": price_missing,
                "market_value": _round_2(native_market_value),
                "converted_market_value": _round_2(converted_market_value),
                "unrealized_gain": _round_2(
                    native_market_value - native_cost_basis
                ),
                "converted_unrealized_gain": _round_2(
                    converted_unrealized_gain
                ),
            }
        )

    total = cash_total + holdings_total
    for row in cash_rows:
        row["allocation_percent"] = _allocation_percent(
            row["converted_value"], total
        )
    for row in holding_rows:
        row["allocation_percent"] = _allocation_percent(
            row["converted_market_value"], total
        )

    return {
        "currency": currency,
        "account": {
            "id": account.id,
            "name": account.name,
            "type": account.type,
            "type_display": account.get_type_display(),
            "deleted": account.deleted,
            "created_on": account.created_on,
            "updated_on": account.updated_on,
            "cash_balance_labels": cash_native_for_labels,
        },
        "totals": {
            "cash_total": _round_2(cash_total),
            "holdings_total": _round_2(holdings_total),
            "total": _round_2(total),
            "currency": currency,
        },
        "cash_balances": cash_rows,
        "holdings": holding_rows,
        "allocations": {
            "cash_vs_holdings": [
                {"name": "Cash", "amount": _round_2(cash_total)},
                {"name": "Holdings", "amount": _round_2(holdings_total)},
            ],
            "holdings_by_asset_class": [
                {
                    "asset_class": asset_class,
                    "label": _security_asset_class_label(asset_class),
                    "amount": _round_2(amount),
                }
                for asset_class, amount in sorted(
                    holdings_by_asset_class.items()
                )
            ],
            "holdings_by_security": sorted(
                holdings_by_security,
                key=lambda row: row["amount"],
                reverse=True,
            ),
        },
        "activity": _account_activity_payload(user, account),
    }


@api_view(["GET", "POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def account_collection(request):
    if request.method == "GET":
        accounts = (
            Account.objects.filter(user=request.user)
            .prefetch_related(
                "cash_balances__currency",
                "holdings__security__currency",
                "holdings__security__prices",
            )
            .order_by("id")
        )
        return Response(
            AccountSerializer(accounts, many=True).data,
            status=status.HTTP_200_OK,
        )

    payload = request.data.copy()
    raw_cash_balances = payload.pop("cash_balances", None)
    currency_code = str(payload.pop("currency", "")).strip().upper()
    amount_raw = payload.pop("amount", None)

    serializer = AccountSerializer(data=payload)
    serializer.is_valid(raise_exception=True)

    parsed_cash_balances = None
    if raw_cash_balances is not None:
        if (
            not isinstance(raw_cash_balances, list)
            or len(raw_cash_balances) == 0
        ):
            return Response(
                {"error": "cash_balances must contain at least one item."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parsed_cash_balances = []
        seen_currency_ids = set()
        for row in raw_cash_balances:
            if not isinstance(row, dict):
                return Response(
                    {"error": "Each cash balance must be an object."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            raw_currency = row.get("currency")
            if raw_currency in (None, ""):
                return Response(
                    {"error": "Each cash balance requires currency."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            raw_amount = row.get("amount", 0)
            try:
                amount = _to_decimal(raw_amount)
            except Exception:
                return Response(
                    {"error": "Invalid cash balance amount."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if amount < 0:
                return Response(
                    {"error": "Cash balance amount must be >= 0."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            currency = None
            if isinstance(raw_currency, int) or (
                isinstance(raw_currency, str) and raw_currency.isdigit()
            ):
                currency = Currency.objects.filter(
                    pk=int(raw_currency)
                ).first()
            else:
                currency = Currency.objects.filter(
                    code=str(raw_currency).strip().upper()
                ).first()

            if currency is None:
                return Response(
                    {"error": f"Currency '{raw_currency}' not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if currency.id in seen_currency_ids:
                return Response(
                    {
                        "error": "Duplicate currencies in cash_balances are not allowed."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            seen_currency_ids.add(currency.id)
            parsed_cash_balances.append(
                {"currency": currency, "amount": amount}
            )
    else:
        if amount_raw not in (None, "") and not currency_code:
            return Response(
                {"error": "Currency is required when amount is provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        currency = None
        amount = None
        if currency_code:
            currency = Currency.objects.filter(code=currency_code).first()
            if currency is None:
                return Response(
                    {"error": f"Currency '{currency_code}' not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                amount = _to_decimal(amount_raw)
            except Exception:
                return Response(
                    {"error": "Invalid account amount."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if amount < 0:
                return Response(
                    {"error": "Account amount must be >= 0."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

    with db_transaction.atomic():
        account = serializer.save(user=request.user)
        if parsed_cash_balances is not None:
            created_rows = []
            for row in parsed_cash_balances:
                created_rows.append(
                    CashBalance.objects.create(
                        account=account,
                        currency=row["currency"],
                        balance=row["amount"],
                    )
                )

            primary = next(
                (row for row in created_rows if row.currency.code == "EUR"),
                created_rows[0],
            )
            account.amount = float(primary.balance)
            account.currency = primary.currency.code
            account.save(update_fields=["amount", "currency"])
        elif currency is not None:
            account.amount = float(amount)
            account.currency = currency.code
            account.save(update_fields=["amount", "currency"])
            CashBalance.objects.create(
                account=account, currency=currency, balance=amount
            )

    return Response(
        AccountSerializer(account).data, status=status.HTTP_201_CREATED
    )


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def account_totals(request):
    currency = request.GET.get("currency", "EUR")
    account_id = request.GET.get("account_id")
    accounts = (
        Account.objects.filter(user=request.user)
        .prefetch_related(
            "cash_balances__currency",
            "holdings__security__currency",
            "holdings__security__prices",
        )
        .order_by("id")
    )
    if account_id:
        accounts = accounts.filter(id=account_id)

    try:
        payload = _account_totals_payload(accounts, currency)
    except MissingExchangeRate as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )

    return Response(payload, status=status.HTTP_200_OK)


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def account_overview(request, account_id):
    currency = request.GET.get("currency", "EUR")
    account = get_object_or_404(
        Account.objects.prefetch_related(
            "cash_balances__currency",
            "holdings__security__currency",
            "holdings__security__prices",
        ),
        id=account_id,
        user=request.user,
    )

    try:
        payload = _account_overview_payload(account, request.user, currency)
    except MissingExchangeRate as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )

    return Response(payload, status=status.HTTP_200_OK)


@api_view(["PUT", "PATCH", "DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def account_detail(request, account_id, deleted=None):
    account = get_object_or_404(Account, id=account_id, user=request.user)

    if request.method == "DELETE":
        account.delete()
        return Response(
            {"message": "Account deleted."}, status=status.HTTP_200_OK
        )

    if deleted is not None:
        account.deleted = bool(deleted)
        account.save(update_fields=["deleted"])
        message = (
            "Account soft deleted." if account.deleted else "Account restored."
        )
        return Response(
            {"message": message, "deleted": account.deleted},
            status=status.HTTP_200_OK,
        )

    serializer = AccountSerializer(account, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save(user=request.user)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def account_stats(request, account_id):
    account = get_object_or_404(Account, id=account_id, user=request.user)
    today = timezone.now().date()
    start_of_month = today.replace(day=1)
    start_of_year = today.replace(month=1, day=1)
    first_day_current_month = today.replace(day=1)
    last_day_prev_month = first_day_current_month - timedelta(days=1)
    first_day_prev_month = last_day_prev_month.replace(day=1)

    income_month_rows = list(
        Transaction.objects.filter(
            is_draft=False,
            user=request.user,
            transaction_type="income",
            income_detail__to_cash_balance__account=account,
            date__gte=start_of_month,
            date__lte=today,
        )
        .annotate(calc_amount=F("income_detail__amount"))
        .values("date", "calc_amount")
    ) + list(
        Transaction.objects.filter(
            is_draft=False,
            user=request.user,
            transaction_type="transfer",
            transfer_detail__to_cash_balance__account=account,
            date__gte=start_of_month,
            date__lte=today,
        )
        .annotate(
            calc_amount=ExpressionWrapper(
                F("transfer_detail__amount") * F("transfer_detail__fx_rate"),
                output_field=DecimalField(max_digits=19, decimal_places=8),
            )
        )
        .values("date", "calc_amount")
    )

    expense_month_rows = list(
        Transaction.objects.filter(
            is_draft=False,
            user=request.user,
            transaction_type="expense",
            expense_detail__from_cash_balance__account=account,
            date__gte=start_of_month,
            date__lte=today,
        )
        .annotate(calc_amount=F("expense_detail__amount"))
        .values("date", "calc_amount")
    ) + list(
        Transaction.objects.filter(
            is_draft=False,
            user=request.user,
            transaction_type="transfer",
            transfer_detail__from_cash_balance__account=account,
            date__gte=start_of_month,
            date__lte=today,
        )
        .annotate(calc_amount=F("transfer_detail__amount"))
        .values("date", "calc_amount")
    )

    income_year_rows = list(
        Transaction.objects.filter(
            is_draft=False,
            user=request.user,
            transaction_type="income",
            income_detail__to_cash_balance__account=account,
            date__gte=start_of_year,
            date__lte=today,
        )
        .annotate(calc_amount=F("income_detail__amount"))
        .values("date", "calc_amount")
    ) + list(
        Transaction.objects.filter(
            is_draft=False,
            user=request.user,
            transaction_type="transfer",
            transfer_detail__to_cash_balance__account=account,
            date__gte=start_of_year,
            date__lte=today,
        )
        .annotate(
            calc_amount=ExpressionWrapper(
                F("transfer_detail__amount") * F("transfer_detail__fx_rate"),
                output_field=DecimalField(max_digits=19, decimal_places=8),
            )
        )
        .values("date", "calc_amount")
    )

    expense_year_rows = list(
        Transaction.objects.filter(
            is_draft=False,
            user=request.user,
            transaction_type="expense",
            expense_detail__from_cash_balance__account=account,
            date__gte=start_of_year,
            date__lte=today,
        )
        .annotate(calc_amount=F("expense_detail__amount"))
        .values("date", "calc_amount")
    ) + list(
        Transaction.objects.filter(
            is_draft=False,
            user=request.user,
            transaction_type="transfer",
            transfer_detail__from_cash_balance__account=account,
            date__gte=start_of_year,
            date__lte=today,
        )
        .annotate(calc_amount=F("transfer_detail__amount"))
        .values("date", "calc_amount")
    )

    last_month_income_rows = list(
        Transaction.objects.filter(
            is_draft=False,
            user=request.user,
            transaction_type="income",
            income_detail__to_cash_balance__account=account,
            date__gte=first_day_prev_month,
            date__lte=last_day_prev_month,
        )
        .annotate(calc_amount=F("income_detail__amount"))
        .values("calc_amount")
    ) + list(
        Transaction.objects.filter(
            is_draft=False,
            user=request.user,
            transaction_type="transfer",
            transfer_detail__to_cash_balance__account=account,
            date__gte=first_day_prev_month,
            date__lte=last_day_prev_month,
        )
        .annotate(
            calc_amount=ExpressionWrapper(
                F("transfer_detail__amount") * F("transfer_detail__fx_rate"),
                output_field=DecimalField(max_digits=19, decimal_places=8),
            )
        )
        .values("calc_amount")
    )
    last_month_expense_rows = list(
        Transaction.objects.filter(
            is_draft=False,
            user=request.user,
            transaction_type="expense",
            expense_detail__from_cash_balance__account=account,
            date__gte=first_day_prev_month,
            date__lte=last_day_prev_month,
        )
        .annotate(calc_amount=F("expense_detail__amount"))
        .values("calc_amount")
    ) + list(
        Transaction.objects.filter(
            is_draft=False,
            user=request.user,
            transaction_type="transfer",
            transfer_detail__from_cash_balance__account=account,
            date__gte=first_day_prev_month,
            date__lte=last_day_prev_month,
        )
        .annotate(calc_amount=F("transfer_detail__amount"))
        .values("calc_amount")
    )

    income_month = _summarize_rows(income_month_rows)
    expense_month = _summarize_rows(expense_month_rows)
    income_year = _summarize_rows(income_year_rows)
    expense_year = _summarize_rows(expense_year_rows)

    income_categories = list(
        Transaction.objects.filter(
            user=request.user,
            transaction_type="income",
            income_detail__to_cash_balance__account=account,
            date__gte=start_of_month,
            date__lte=today,
        )
        .values("income_detail__category__category")
        .annotate(total_amount=Sum("income_detail__amount"))
    )
    total_income_cats = sum(
        (_to_decimal(item["total_amount"]) for item in income_categories),
        Decimal("0"),
    )
    incomes_by_category = []
    for item in income_categories:
        amount = _to_decimal(item["total_amount"])
        if total_income_cats > 0:
            incomes_by_category.append(
                {
                    "category__category": item[
                        "income_detail__category__category"
                    ]
                    or "Uncategorized",
                    "total_amount": _round_2(amount),
                    "percentage": _round_2(
                        (amount * Decimal("100")) / total_income_cats
                    ),
                }
            )

    expense_categories = list(
        Transaction.objects.filter(
            user=request.user,
            transaction_type="expense",
            expense_detail__from_cash_balance__account=account,
            date__gte=start_of_month,
            date__lte=today,
        )
        .values("expense_detail__category__category")
        .annotate(total_amount=Sum("expense_detail__amount"))
    )
    total_expense_cats = sum(
        (_to_decimal(item["total_amount"]) for item in expense_categories),
        Decimal("0"),
    )
    expenses_by_category = []
    for item in expense_categories:
        amount = _to_decimal(item["total_amount"])
        if total_expense_cats > 0:
            expenses_by_category.append(
                {
                    "category__category": item[
                        "expense_detail__category__category"
                    ]
                    or "Uncategorized",
                    "total_amount": _round_2(amount),
                    "percentage": _round_2(
                        (amount * Decimal("100")) / total_expense_cats
                    ),
                }
            )

    transactions_by_month = list(
        Transaction.objects.filter(is_draft=False, user=request.user)
        .filter(
            Q(
                transaction_type="income",
                income_detail__to_cash_balance__account=account,
            )
            | Q(
                transaction_type="expense",
                expense_detail__from_cash_balance__account=account,
            )
            | Q(
                transaction_type="transfer",
                transfer_detail__from_cash_balance__account=account,
            )
            | Q(
                transaction_type="transfer",
                transfer_detail__to_cash_balance__account=account,
            )
        )
        .distinct()
        .annotate(month_year=TruncMonth("date"))
        .values("month_year")
        .annotate(
            income_count=Count("id", filter=Q(transaction_type="income")),
            expense_count=Count("id", filter=Q(transaction_type="expense")),
            transfer_count=Count("id", filter=Q(transaction_type="transfer")),
        )
        .order_by("month_year")
    )

    balances = list(account.cash_balances.all())
    primary_balance = None
    if balances:
        primary_balance = (
            next(
                (
                    balance
                    for balance in balances
                    if balance.currency.code == "EUR"
                ),
                None,
            )
            or balances[0]
        )

    last_month_income_total = sum(
        (
            _to_decimal(item.get("calc_amount", item.get("amount")))
            for item in last_month_income_rows
        ),
        Decimal("0"),
    )
    last_month_expense_total = sum(
        (
            _to_decimal(item.get("calc_amount", item.get("amount")))
            for item in last_month_expense_rows
        ),
        Decimal("0"),
    )

    result = {
        "current_balance": (
            _round_2(primary_balance.balance) if primary_balance else 0.0
        ),
        "net_month_to_date": _round_2(
            _to_decimal(income_month["total"])
            - _to_decimal(expense_month["total"])
        ),
        "net_year_to_date": _round_2(
            _to_decimal(income_year["total"])
            - _to_decimal(expense_year["total"])
        ),
        "transactions_this_month": income_month["count"]
        + expense_month["count"],
        "transactions_this_year": income_year["count"] + expense_year["count"],
        "last_month_p_and_l": _round_2(
            last_month_income_total - last_month_expense_total
        ),
        "incomes_by_category": sorted(
            incomes_by_category,
            key=lambda row: row["total_amount"],
            reverse=True,
        ),
        "expenses_by_category": sorted(
            expenses_by_category,
            key=lambda row: row["total_amount"],
            reverse=True,
        ),
        "transactions_by_month": transactions_by_month,
        "running_total_expenses_current_month": expense_month["running_total"],
        "running_total_incomes_current_month": income_month["running_total"],
        "running_total_expenses_current_year": expense_year["running_total"],
        "running_total_incomes_current_year": income_year["running_total"],
        "moving_avg_expenses_current_month": expense_month["moving_avg"],
        "moving_avg_incomes_current_month": income_month["moving_avg"],
        "moving_avg_expenses_current_year": expense_year["moving_avg"],
        "moving_avg_incomes_current_year": income_year["moving_avg"],
    }
    return Response(result, status=status.HTTP_200_OK)


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def account_transactions(request, account_id):
    account = get_object_or_404(Account, id=account_id, user=request.user)
    transactions = (
        Transaction.objects.filter(is_draft=False, user=request.user)
        .filter(
            Q(
                transaction_type="income",
                income_detail__to_cash_balance__account=account,
            )
            | Q(
                transaction_type="expense",
                expense_detail__from_cash_balance__account=account,
            )
            | Q(
                transaction_type="transfer",
                transfer_detail__from_cash_balance__account=account,
            )
            | Q(
                transaction_type="transfer",
                transfer_detail__to_cash_balance__account=account,
            )
            | Q(
                transaction_type__in=("buy", "sell"),
                security_trade_detail__cash_balance__account=account,
            )
        )
        .distinct()
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
            "security_trade_detail__cash_balance__account",
            "security_trade_detail__cash_balance__currency",
        )
        .prefetch_related("tags")
        .order_by("-date", "-id")
    )

    payload = []
    for transaction in transactions:
        row = {
            "id": transaction.id,
            "user": transaction.user_id,
            "transaction_type": transaction.transaction_type,
            "date": transaction.date,
            "description": transaction.description,
            "created_on": transaction.created_on,
            "tags": [
                {"id": tag.id, "name": tag.name, "created_on": tag.created_on}
                for tag in transaction.tags.all()
            ],
            "amount": 0.0,
            "category": None,
            "from_account": None,
            "to_account": None,
            "security": None,
            "ticker": None,
            "quantity": None,
            "price_per_unit": None,
            "cash_balance": None,
            "currency": None,
        }

        if transaction.transaction_type == "income":
            detail = transaction.income_detail
            row["amount"] = _round_2(detail.amount)
            row["category"] = detail.category_id
            row["to_account"] = detail.to_cash_balance.account_id
            row["currency"] = detail.to_cash_balance.currency.code
        elif transaction.transaction_type == "expense":
            detail = transaction.expense_detail
            row["amount"] = _round_2(detail.amount)
            row["category"] = detail.category_id
            row["from_account"] = detail.from_cash_balance.account_id
            row["currency"] = detail.from_cash_balance.currency.code
        elif transaction.transaction_type == "transfer":
            detail = transaction.transfer_detail
            row["from_account"] = detail.from_cash_balance.account_id
            row["to_account"] = detail.to_cash_balance.account_id
            row["currency"] = detail.from_cash_balance.currency.code
            if detail.to_cash_balance.account_id == account.id:
                row["amount"] = _round_2(detail.amount * detail.fx_rate)
                row["currency"] = detail.to_cash_balance.currency.code
            else:
                row["amount"] = _round_2(detail.amount)
        elif transaction.transaction_type in ("buy", "sell"):
            detail = transaction.security_trade_detail
            row["security"] = detail.security_id
            row["ticker"] = detail.security.ticker
            row["quantity"] = _round_2(detail.quantity)
            row["price_per_unit"] = _round_2(detail.price_per_unit)
            row["cash_balance"] = detail.cash_balance_id
            row["currency"] = detail.cash_balance.currency.code
            row["amount"] = _round_2(detail.total_value)
            if transaction.transaction_type == "buy":
                row["from_account"] = detail.cash_balance.account_id
            else:
                row["to_account"] = detail.cash_balance.account_id

        payload.append(row)

    return Response(payload, status=status.HTTP_200_OK)


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def portfolio_history(request):
    """
    Return timeseries of total investment (holdings) value over a timeframe.

    Query params:
      - timeframe: 1D, 5D, MTD, YTD, 1Y, 5Y, MAX (default: 1Y)
      - currency:   target currency code (default: EUR)
    """
    timeframe = request.GET.get("timeframe", "1Y").strip().upper()
    currency = request.GET.get("currency", "EUR").strip().upper()

    valid_timeframes = {"1D", "5D", "MTD", "YTD", "1Y", "5Y", "MAX"}
    if timeframe not in valid_timeframes:
        return Response(
            {"error": f"Invalid timeframe. Choose from: {', '.join(sorted(valid_timeframes))}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from Accounts.services.portfolio_history import build_portfolio_timeseries

    try:
        data = build_portfolio_timeseries(request.user, timeframe, currency)
    except ValueError as exc:
        return Response(
            {"error": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(data, status=status.HTTP_200_OK)
