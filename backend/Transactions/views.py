from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.authtoken.models import Token

from .serializers import (
    ExpenseCategorySerializer,
    IncomeCategorySerializer,
    ExpenseSerializer,
    IncomeSerializer,
    TransferSerializer
)

from .models import ExpenseCategory, IncomeCategory, Expense, Transfer, Income
from Users.models import User
from Accounts.models import Account


@api_view(["POST"])
def add_transaction(request):

    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id
    
    p = request.data
    p["user_id"] = user_id

    value = round(float(p["amount"]), 2)

    try:
        # If it's a transfer
        if p["type"] == 2:

            p["to_account_id"] = int(p.pop("to_account"))
            p["from_account_id"] = int(p.pop("from_account"))

            # Update source and dest accounts
            from_account = Account.objects.filter(pk=p["from_account_id"])
            to_account = Account.objects.filter(pk=p["to_account_id"])

            from_account.update(
                amount=from_account.first().amount - value 
            )
            to_account.update(amount=round(to_account.first().amount, 2) + value)
            p.pop('type') 
            Transfer(**p).save()
        elif p["type"] == 1:  # This is an expense

            p["account_id"] = int(p.pop("account"))
            p["expense_category_id"] = int(p.pop("expense_category"))

            # Update account balance
            selected_account = Account.objects.filter(pk=p["account_id"])
            selected_account.update(
                amount=round(selected_account.first().amount, 2) - value 
            )
            p.pop('type') 
            Expense(**p).save()
        elif p["type"] == 0:  # This is an income

            p["account_id"] = int(p.pop("account"))
            p["income_category_id"] = int(p.pop("income_category"))

            selected_account = Account.objects.filter(pk=p["account_id"])
            selected_account.update(
                amount=round(selected_account.first().amount, 2) + value
            )
            p.pop('type') 
            Income(**p).save()

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

    pass

@api_view(["GET"])
def get_income_categories(request):

    categories = IncomeCategory.objects.all()
    serializer = IncomeCategorySerializer(categories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
def get_expense_categories(request):

    categories = ExpenseCategory.objects.all()
    serializer = ExpenseCategorySerializer(categories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
def get_all_expenses(request):

    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    results = Expense.objects.filter(user_id=user_id)

    serializer = ExpenseSerializer(results, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(["GET"])
def get_all_incomes(request):

    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    results = Income.objects.filter(user_id=user_id)

    serializer = IncomeSerializer(results, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(["GET"])
def get_all_transfers(request):

    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    results = Transfer.objects.filter(user_id=user_id)

    serializer = TransferSerializer(results, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)
