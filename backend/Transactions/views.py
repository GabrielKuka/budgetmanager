from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view
from rest_framework.response import Response

from Accounts.models import Account
from Users.models import User
from tags.models import Tag

from .models import Expense, Income, Transfer, TransactionCategory
from Accounts.serialzers import AccountSerializer
from .serializers import (
    ExpenseSerializer,
    IncomeSerializer,
    TransferSerializer,
    TransactionCategorySerializer,
)


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
            from_amount = round(float(p.pop("from_amount")), 2)
            to_amount = round(float(p.pop("to_amount")), 2)

            p["to_account_id"] = int(p.pop("to_account"))
            p["from_account_id"] = int(p.pop("from_account"))

            # Update source and dest accounts
            from_account = Account.objects.filter(pk=p["from_account_id"])
            to_account = Account.objects.filter(pk=p["to_account_id"])

            from_account.update(
                amount=from_account.first().amount - from_amount
            )
            to_account.update(
                amount=round(to_account.first().amount, 2) + to_amount
            )

            p.pop("type")
            p["amount"] = from_amount

            serializer = TransferSerializer(data=p)
            if not serializer.is_valid():
                raise Exception(f"{serializer.errors}")

            serializer.save(
                user_id=user_id,
                from_account_id=p["from_account_id"],
                to_account_id=p["to_account_id"],
            )
            # Transfer(**p).save()
        elif p["type"] == 1:  # This is an expense
            value = round(float(p["amount"]), 2)
            p["account_id"] = int(p.pop("account"))
            p["expense_category_id"] = int(p.pop("expense_category"))

            # Update account balance
            selected_account = Account.objects.filter(pk=p["account_id"])
            selected_account.update(
                amount=round(selected_account.first().amount, 2) - value
            )
            p.pop("type")

            serializer = ExpenseSerializer(data=p)
            if not serializer.is_valid():
                raise Exception(f"{serializer.errors}")

            serializer.save(
                user_id=user_id,
                account_id=p["account_id"],
                expense_category_id=p["expense_category_id"],
            )
            # Expense(**p).save()
        elif p["type"] == 0:  # This is an income
            value = round(float(p["amount"]), 2)
            p["account_id"] = int(p.pop("account"))
            p["income_category_id"] = int(p.pop("income_category"))

            selected_account = Account.objects.filter(pk=p["account_id"])
            selected_account.update(
                amount=round(selected_account.first().amount, 2) + value
            )
            p.pop("type")

            serializer = IncomeSerializer(data=p)
            if not serializer.is_valid():
                raise Exception(f"{serializer.errors}")

            serializer.save(
                user_id=user_id,
                account_id=p["account_id"],
                income_category_id=p["income_category_id"],
            )
            # Income(**p).save()
        return Response(
            {"message": "Transaction Added."}, status=status.HTTP_201_CREATED
        )
    except Exception as e:
        print(e)
        return Response(
            {"error": "Error adding transaction"},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["POST"])
def delete_transaction(request):
    p = request.data

    try:
        transaction_id = int(p["id"])
        transaction_type = int(p["type"])
        if transaction_type == 2:  # A transfer
            transaction = Transfer.objects.get(id=transaction_id)
            from_account_id = transaction.from_account_id
            to_account_id = transaction.to_account_id

            from_account = Account.objects.get(id=from_account_id)
            to_account = Account.objects.get(id=to_account_id)

            account_serializer = AccountSerializer(
                from_account,
                data={
                    "amount": round(from_account.amount, 2)
                    + transaction.amount
                },
                partial=True,
            )

            if account_serializer.is_valid():
                account_serializer.save()
            else:
                raise Exception("Source Account could not be updated.")

            account_serializer = AccountSerializer(
                to_account,
                data={
                    "amount": round(to_account.amount, 2) - transaction.amount
                },
                partial=True,
            )

            if account_serializer.is_valid():
                account_serializer.save()
            else:
                raise Exception("Destination Account could not be updated.")

            # Delete transaction
            transaction.delete()
            return Response(
                {"msg": "Transaction deleted"}, status=status.HTTP_200_OK
            )
        elif transaction_type == 1:  # An expense
            # Increase the associated account balance
            transaction = Expense.objects.get(id=transaction_id)

            account_id = transaction.account_id
            account = Account.objects.get(id=account_id)
            account_serializer = AccountSerializer(
                account,
                data={"amount": round(account.amount, 2) + transaction.amount},
                partial=True,
            )

            if account_serializer.is_valid():
                account_serializer.save()
            else:
                raise Exception("Account could not be updated.")

            # Delete the expense object
            transaction.delete()
            return Response(
                {"msg": "Transaction deleted"}, status=status.HTTP_200_OK
            )
        elif transaction_type == 0:  # An income
            # Decrease the associated account balance
            transaction = Income.objects.get(id=transaction_id)
            account_id = transaction.account_id
            account = Account.objects.get(id=account_id)

            account_serializer = AccountSerializer(
                account,
                data={"amount": round(account.amount, 2) - transaction.amount},
                partial=True,
            )

            if account_serializer.is_valid():
                account_serializer.save()
            else:
                raise Exception("Account could not be updated.")

            # Delete the expense object
            transaction.delete()
            return Response(
                {"msg": "Transaction deleted"}, status=status.HTTP_200_OK
            )
        else:
            raise Exception("Incorrect transaction type.")
    except Exception as e:
        print(e)
        return Response({"msg": "Test"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
def get_all_transactions(request):
    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    pass


@api_view(["GET"])
def get_income_categories(request):
    categories = TransactionCategory.objects.filter(category_type="0")
    serializer = TransactionCategorySerializer(categories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
def get_expense_categories(request):
    categories = TransactionCategory.objects.filter(category_type="1")
    serializer = TransactionCategorySerializer(categories, many=True)
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
