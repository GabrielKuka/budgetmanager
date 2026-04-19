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

from Transactions.models import Transaction

from .models import Account, CashBalance, Currency
from .serializers import AccountSerializer


def _to_decimal(value):
    if isinstance(value, Decimal):
        return value
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _round_2(value):
    return float(_to_decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _summarize_rows(rows):
    ordered_rows = sorted(rows, key=lambda row: row["date"])
    amounts = [_to_decimal(row.get("amount", row.get("calc_amount", 0))) for row in ordered_rows]

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
            AccountSerializer(accounts, many=True).data, status=status.HTTP_200_OK
        )

    payload = request.data.copy()
    raw_cash_balances = payload.pop("cash_balances", None)
    currency_code = str(payload.pop("currency", "")).strip().upper()
    amount_raw = payload.pop("amount", None)

    serializer = AccountSerializer(data=payload)
    serializer.is_valid(raise_exception=True)

    parsed_cash_balances = None
    if raw_cash_balances is not None:
        if not isinstance(raw_cash_balances, list) or len(raw_cash_balances) == 0:
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
                currency = Currency.objects.filter(pk=int(raw_currency)).first()
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
                    {"error": "Duplicate currencies in cash_balances are not allowed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            seen_currency_ids.add(currency.id)
            parsed_cash_balances.append({"currency": currency, "amount": amount})
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

    return Response(AccountSerializer(account).data, status=status.HTTP_201_CREATED)


@api_view(["PUT", "PATCH", "DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def account_detail(request, account_id, deleted=None):
    account = get_object_or_404(Account, id=account_id, user=request.user)

    if request.method == "DELETE":
        account.delete()
        return Response({"message": "Account deleted."}, status=status.HTTP_200_OK)

    if deleted is not None:
        account.deleted = bool(deleted)
        account.save(update_fields=["deleted"])
        message = "Account soft deleted." if account.deleted else "Account restored."
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
        (_to_decimal(item["total_amount"]) for item in income_categories), Decimal("0")
    )
    incomes_by_category = []
    for item in income_categories:
        amount = _to_decimal(item["total_amount"])
        if total_income_cats > 0:
            incomes_by_category.append(
                {
                    "category__category": item["income_detail__category__category"]
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
        (_to_decimal(item["total_amount"]) for item in expense_categories), Decimal("0")
    )
    expenses_by_category = []
    for item in expense_categories:
        amount = _to_decimal(item["total_amount"])
        if total_expense_cats > 0:
            expenses_by_category.append(
                {
                    "category__category": item["expense_detail__category__category"]
                    or "Uncategorized",
                    "total_amount": _round_2(amount),
                    "percentage": _round_2(
                        (amount * Decimal("100")) / total_expense_cats
                    ),
                }
            )

    transactions_by_month = list(
        Transaction.objects.filter(user=request.user)
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
                (balance for balance in balances if balance.currency.code == "EUR"),
                None,
            )
            or balances[0]
        )

    last_month_income_total = sum(
        (_to_decimal(item.get("calc_amount", item.get("amount"))) for item in last_month_income_rows), Decimal("0")
    )
    last_month_expense_total = sum(
        (_to_decimal(item.get("calc_amount", item.get("amount"))) for item in last_month_expense_rows), Decimal("0")
    )

    result = {
        "current_balance": (
            _round_2(primary_balance.balance) if primary_balance else 0.0
        ),
        "net_month_to_date": _round_2(
            _to_decimal(income_month["total"]) - _to_decimal(expense_month["total"])
        ),
        "net_year_to_date": _round_2(
            _to_decimal(income_year["total"]) - _to_decimal(expense_year["total"])
        ),
        "transactions_this_month": income_month["count"] + expense_month["count"],
        "transactions_this_year": income_year["count"] + expense_year["count"],
        "last_month_p_and_l": _round_2(
            last_month_income_total - last_month_expense_total
        ),
        "incomes_by_category": sorted(
            incomes_by_category, key=lambda row: row["total_amount"], reverse=True
        ),
        "expenses_by_category": sorted(
            expenses_by_category, key=lambda row: row["total_amount"], reverse=True
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
        Transaction.objects.filter(user=request.user)
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
        .select_related(
            "income_detail__to_cash_balance__account",
            "income_detail__category",
            "expense_detail__from_cash_balance__account",
            "expense_detail__category",
            "transfer_detail__from_cash_balance__account",
            "transfer_detail__to_cash_balance__account",
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
        }

        if transaction.transaction_type == "income":
            detail = transaction.income_detail
            row["amount"] = _round_2(detail.amount)
            row["category"] = detail.category_id
            row["to_account"] = detail.to_cash_balance.account_id
        elif transaction.transaction_type == "expense":
            detail = transaction.expense_detail
            row["amount"] = _round_2(detail.amount)
            row["category"] = detail.category_id
            row["from_account"] = detail.from_cash_balance.account_id
        elif transaction.transaction_type == "transfer":
            detail = transaction.transfer_detail
            row["from_account"] = detail.from_cash_balance.account_id
            row["to_account"] = detail.to_cash_balance.account_id
            if detail.to_cash_balance.account_id == account.id:
                row["amount"] = _round_2(detail.amount * detail.fx_rate)
            else:
                row["amount"] = _round_2(detail.amount)

        payload.append(row)

    return Response(payload, status=status.HTTP_200_OK)
