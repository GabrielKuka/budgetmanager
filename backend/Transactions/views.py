from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.authtoken.models import Token

from .serializers import (
    TransactionSerializer,
    ExpenseCategorySerializer,
    IncomeCategorySerializer,
)

from .models import FactTransaction, DimExpenseCategory, DimIncomeCategory
from Users.models import User
from Accounts.models import DimAccount


@api_view(["POST"])
def add_transaction(request):

    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    p = request.data
    p["user_id"] = user_id

    try:
        # If it's a transfer
        if p["type"] == 2:

            p["to_account_id"] = int(p.pop("to_account"))
            p["from_account_id"] = int(p.pop("from_account"))

            # Update source and dest accounts
            from_account = DimAccount.objects.filter(pk=p["from_account_id"])
            to_account = DimAccount.objects.filter(pk=p["to_account_id"])

            from_account.update(
                amount=from_account.first().amount - p["amount"]
            )
            to_account.update(amount=p["amount"] + to_account.first().amount)
        elif p["type"] == 1:  # This is an expense

            p["account_id"] = int(p.pop("account"))
            p["expense_category_id"] = int(p.pop("expense_category"))

            # Update account balance
            selected_account = DimAccount.objects.filter(pk=p["account_id"])
            selected_account.update(
                amount=selected_account.first().amount - p["amount"]
            )
        elif p["type"] == 0:  # This is an income

            p["account_id"] = int(p.pop("account"))
            p["income_category_id"] = int(p.pop("income_category"))

            selected_account = DimAccount.objects.filter(pk=p["account_id"])
            selected_account.update(
                amount=p["amount"] + selected_account.first().amount
            )

        # Create transaction record
        transaction = FactTransaction(**p)
        transaction.save()
        return Response(
            {"message": "Transaction Added."}, status=status.HTTP_201_CREATED
        )
    except Exception as e:
        print(e)
        return Response(
            {"error": "Error adding transaction"},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["GET"])
def get_all_transactions(request):

    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    transactions = FactTransaction.objects.all()
    serializer = TranscationSerializer(transactions, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
def get_income_categories(request):

    categories = DimIncomeCategory.objects.all()
    serializer = IncomeCategorySerializer(categories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
def get_expense_categories(request):

    categories = DimExpenseCategory.objects.all()
    serializer = ExpenseCategorySerializer(categories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
def get_all_expenses(request):

    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    results = FactTransaction.objects.filter(user_id=user_id, type=1)

    serializer = TransactionSerializer(results, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(["GET"])
def get_all_incomes(request):

    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    results = FactTransaction.objects.filter(user_id=user_id, type=0)

    serializer = TransactionSerializer(results, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(["GET"])
def get_all_transfers(request):

    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    results = FactTransaction.objects.filter(user_id=user_id, type=2)

    serializer = TransactionSerializer(results, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)
