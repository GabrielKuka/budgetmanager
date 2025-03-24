from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models.expressions import RowRange

from .models import Account
from Transactions.models import Expense, Income
from Transactions.serializers import IncomeSerializer, ExpenseSerializer
from django.shortcuts import get_object_or_404, redirect
from .serialzers import AccountSerializer
from django.db.models import (
    Sum,
    Avg,
    Max,
    Min,
    Count,
    Window,
    F,
    StdDev,
    Variance,
)
from datetime import datetime


@api_view(["POST"])
def create_account(request):
    # Retrieve user token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id
    p = request.data
    p["user_id"] = user_id

    try:
        Account(**p).save()
        return Response(
            {"message": "Account created."}, status=status.HTTP_201_CREATED
        )
    except:
        return Response(
            {"error": "Error creating account."},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["PUT"])
def soft_delete(request, account_id):
    account = get_object_or_404(Account, id=account_id)
    account.soft_delete()

    return Response(
        {"message": "Account soft deleted."}, status=status.HTTP_200_OK
    )


@api_view(["PUT"])
def restore_account(request, account_id):
    account = get_object_or_404(Account, id=account_id)
    account.restore()

    return Response(
        {"message": "Account restored."}, status=status.HTTP_200_OK
    )


@api_view(["DELETE"])
def delete_account(request, id):

    try:
        Account.objects.filter(pk=id).delete()
        return Response(
            {"message": "Account deleted."}, status=status.HTTP_200_OK
        )
    except:
        return Response(
            {"error": "Error deleting account."},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["GET"])
def get_all_accounts(request):
    # Retrieve user token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    accounts = Account.objects.filter(user=user_id)

    serializer = AccountSerializer(accounts, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
def get_account_data(request, id):

    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    account = get_object_or_404(Account, id=id, user=user_id)

    today = datetime.now()
    start_of_the_month = datetime(today.year, today.month, 1)
    start_of_the_year = datetime(today.year, 1, 1)

    stat_expenses_month = get_account_stats(
        Expense, account, start_of_the_month, today
    )
    stat_incomes_month = get_account_stats(
        Income, account, start_of_the_month, today
    )

    stat_expenses_year = get_account_stats(
        Expense, account, start_of_the_year, today
    )
    stat_incomes_year = get_account_stats(
        Income, account, start_of_the_year, today
    )

    net_month_to_date = round(
        stat_incomes_month["total"] - stat_expenses_month["total"], 2
    )
    net_year_to_date = round(
        stat_incomes_year["total"] - stat_expenses_year["total"], 2
    )

    result = {
        "current_balance": round(account.amount, 2),
        "net_month_to_date": net_month_to_date,
        "net_year_to_date": net_year_to_date,
        "transactions_this_month": stat_incomes_month["count"]
        + stat_expenses_month["count"],
        "transactions_this_year": stat_incomes_year["count"]
        + stat_expenses_year["count"],
        "running_total_expenses_current_month": stat_expenses_month[
            "running_total"
        ],
        "running_total_incomes_current_month": stat_incomes_month[
            "running_total"
        ],
        "running_total_expenses_current_year": stat_expenses_year[
            "running_total"
        ],
        "running_total_incomes_current_year": stat_incomes_year[
            "running_total"
        ],
        "moving_avg_expenses_current_month": stat_expenses_month["moving_avg"],
        "moving_avg_incomes_current_month": stat_incomes_month["moving_avg"],
        "moving_avg_expenses_current_year": stat_expenses_year["moving_avg"],
        "moving_avg_incomes_current_year": stat_incomes_year["moving_avg"],
    }

    return Response(result, status=status.HTTP_200_OK)


@api_view(["GET"])
def get_account_transactions(request, id):
    from itertools import chain

    try:
        expenses = Expense.objects.filter(account=id)
        incomes = Income.objects.filter(account=id)

        serialized_expenses = ExpenseSerializer(expenses, many=True).data
        serialized_incomes = IncomeSerializer(incomes, many=True).data

        transactions = list(chain(serialized_expenses, serialized_incomes))
        transactions.sort(key=lambda x: x.get("date"), reverse=True)

        return Response(transactions, status=status.HTTP_200_OK)
    except Exception as e:
        print(e)
        return Response(
            {"error": "Something went wrong"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


def get_account_stats(transaction_model, account, from_date, to_date):
    transactions = transaction_model.objects.filter(
        account=account, date__gte=from_date, date__lte=to_date
    )

    # Calculate running total using window functions
    running_total_transactions = transactions.annotate(
        running_total=Window(
            expression=Sum("amount"), order_by=F("date").asc()
        )
    )

    # Calculate moving average using window functions
    moving_average_transactions = transactions.annotate(
        moving_avg=Window(
            expression=Avg("amount"),
            order_by=F("date").asc(),
            frame=RowRange(start=-6, end=0),  # 7-day moving average
        )
    )

    return {
        "total": round(
            transactions.aggregate(Sum("amount"))["amount__sum"] or 0, 2
        )
        or 0,
        "average": round(
            transactions.aggregate(Avg("amount"))["amount__avg"] or 0, 2
        )
        or 0,
        "max": round(
            transactions.aggregate(Max("amount"))["amount__max"] or 0, 2
        )
        or 0,
        "min": round(
            transactions.aggregate(Min("amount"))["amount__min"] or 0, 2
        )
        or 0,
        "count": transactions.aggregate(Count("amount"))["amount__count"] or 0,
        "running_total": list(
            running_total_transactions.values(
                "date", "amount", "running_total"
            )
        ),
        "moving_avg": list(
            moving_average_transactions.values("date", "amount", "moving_avg")
        ),
    }
