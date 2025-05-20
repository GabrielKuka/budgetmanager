from django.db.models import Q, F
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils.dateparse import parse_date
from datetime import datetime
from rest_framework.authtoken.models import Token
from typing import List

from .models import Transaction, TransactionCategory, Account
from .serializers import TransactionSerializer, TransactionCategorySerializer


@api_view(["GET"])
def search(request):
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    query = request.GET.get("query")
    try:
        transactions = Transaction.objects.filter(
            Q(user=user_id)
            & (
                Q(category__category__iexact=query)
                | Q(description__icontains=query)
                | Q(tags__name__iexact=query)
            )
        ).distinct()

        serializer = TransactionSerializer(transactions, many=True)

        # Group transactions by type for backward compatibility
        response_data = {
            "expenses": [
                t
                for t in serializer.data
                if t["transaction_type"] == "expense"
            ],
            "incomes": [
                t for t in serializer.data if t["transaction_type"] == "income"
            ],
            "transfers": [
                t
                for t in serializer.data
                if t["transaction_type"] == "transfer"
            ],
        }
        return Response(response_data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
def get_expenses(request):
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    from_date = request.GET.get("from_date")
    to_date = request.GET.get("to_date")

    try:
        # Parse parameters into proper dates
        from_date = parse_date(from_date)
        to_date = parse_date(to_date)

        expenses = Transaction.objects.filter(
            user=user_id,
            transaction_type="expense",
            date__gte=from_date,
            date__lte=to_date,
        )

        serializer = TransactionSerializer(expenses, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)

    except (ValueError, TypeError):
        return Response(
            {"error": "Invalid date format"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
def get_incomes(request):
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    from_date = request.GET.get("from_date")
    to_date = request.GET.get("to_date")

    try:
        # Parse parameters into proper dates
        from_date = parse_date(from_date)
        to_date = parse_date(to_date)

        incomes = Transaction.objects.filter(
            user=user_id,
            transaction_type="income",
            date__gte=from_date,
            date__lte=to_date,
        )

        serializer = TransactionSerializer(incomes, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)

    except (ValueError, TypeError):
        return Response(
            {"error": "Invalid date format"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
def get_transfers(request):
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    from_date = request.GET.get("from_date")
    to_date = request.GET.get("to_date")

    try:
        # Parse parameters into proper dates
        from_date = parse_date(from_date)
        to_date = parse_date(to_date)

        transfers = Transaction.objects.filter(
            user=user_id,
            transaction_type="transfer",
            date__gte=from_date,
            date__lte=to_date,
        )

        serializer = TransactionSerializer(transfers, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)

    except (ValueError, TypeError):
        return Response(
            {"error": "Invalid date format"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

def convert_currency(source: str, targets: List[str]):

    import requests

    url = "https://wise.com/rates/history"
    rates = dict()
    for target in targets:

        if source == target:
            rates[target] = 1
            continue

        params = {
            "source": source,
            "target": target,
            "length": "1",
            "unit": "hour",
            "resolution": "hourly",
        }
        response = requests.get(url=url, params=params)


        response.raise_for_status()
        result = response.json()[0]

        rate = float(result["value"])

        rates[target] = rate

    if not rates:
        raise Exception("No rates were found. This shouldn't happen.")
    
    return rates


@api_view(['GET'])
def get_wealth_stats(request):
    from collections import defaultdict

    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    currency = request.GET.get("currency")

    # Get exchange rates
    rates = convert_currency(currency, ['EUR', 'USD', 'BGN', 'GBP', 'ALL'])

    # Get all accounts for the user and convert their amounts
    user_accounts = Account.objects.filter(user_id=user_id)
    current_total_wealth = sum(round(account.amount / rates.get(account.currency, 1), 2) for account in user_accounts)

    transactions = Transaction.objects.filter(user=user_id).exclude(transaction_type="transfer")
    
    # Group transactions by "%Y-%m"
    grouped_transactions = defaultdict(lambda: {"incomes": 0, "expenses": 0})

    for transaction in transactions:
        month_year = transaction.date.strftime("%Y-%m")
        converted_amount = transaction.amount / rates.get(transaction.account.currency, 1)

        grouped_transactions[month_year][f"{transaction.transaction_type}s"] += converted_amount


    # Sort the grouped transactions by month in descending order
    sorted_months = sorted(grouped_transactions.keys(), reverse=True)

    current_monthly_wealth = current_total_wealth
    monthly_differences = []
    for month_year in sorted_months:
        net_difference = grouped_transactions[month_year]["incomes"] - grouped_transactions[month_year]["expenses"]

        monthly_differences.append({
            "date": month_year,
            "net_difference": round(net_difference, 2),
            "monthly_wealth": round(current_monthly_wealth, 2),
        })

        current_monthly_wealth = current_monthly_wealth - net_difference

    monthly_differences.reverse()

    return Response({"monthly_differences":monthly_differences}, status=status.HTTP_200_OK)



@api_view(["GET"])
def get_transactions(request):
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    from_date = request.GET.get("from_date")
    to_date = request.GET.get("to_date")

    try:
        # Parse parameters into proper dates
        from_date = datetime.strptime(from_date, "%d-%m-%Y").date()
        to_date = datetime.strptime(to_date, "%d-%m-%Y").date()

        # Filter transactions based on the timeframe
        transactions = Transaction.objects.filter(
            user=user_id, date__gte=from_date, date__lte=to_date
        )

        serializer = TransactionSerializer(transactions, many=True)

        # Group transactions by type for backward compatibility
        response_data = {
            "incomes": [
                t for t in serializer.data if t["transaction_type"] == "income"
            ],
            "expenses": [
                t
                for t in serializer.data
                if t["transaction_type"] == "expense"
            ],
            "transfers": [
                t
                for t in serializer.data
                if t["transaction_type"] == "transfer"
            ],
        }

        return Response(data=response_data, status=status.HTTP_200_OK)

    except (ValueError, TypeError):
        return Response(
            {"error": "Invalid date format"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def add_transaction(request):
    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id
    p = request.data.copy()
    p["user"] = user_id

    try:
        transaction_type = int(p.pop("type"))

        # Create base transaction data
        transaction_data = {
            "user": user_id,
            "amount": round(float(p.get("amount", 0)), 2),
            "tags": p.get("tags"),
            "date": p.get("date"),
            "description": p.get("description"),
            "transaction_type": {0: "income", 1: "expense", 2: "transfer"}[
                transaction_type
            ],
        }

        # Handle different transaction types
        if transaction_type == 2:  # Transfer
            from_amount = round(float(p.pop("from_amount")), 2)
            to_amount = round(float(p.pop("to_amount")), 2)

            from_account_id = int(p.pop("from_account"))
            to_account_id = int(p.pop("to_account"))

            # Update source and dest accounts
            from_account = Account.objects.get(pk=from_account_id)
            to_account = Account.objects.get(pk=to_account_id)

            from_account.amount = from_account.amount - from_amount
            from_account.save()

            to_account.amount = round(to_account.amount, 2) + to_amount
            to_account.save()

            # Set transaction details
            transaction_data["amount"] = from_amount
            transaction_data["from_account"] = from_account_id
            transaction_data["to_account"] = to_account_id

        elif transaction_type == 1:  # Expense
            value = round(float(p["amount"]), 2)
            account_id = int(p.pop("from_account"))
            category_id = int(p.pop("category"))

            # Update account balance
            account = Account.objects.get(pk=account_id)
            account.amount = round(account.amount, 2) - value
            account.save()
            # Set transaction details
            transaction_data["from_account"] = account_id
            transaction_data["category"] = category_id

        elif transaction_type == 0:  # Income
            value = round(float(p["amount"]), 2)
            account_id = int(p.pop("to_account"))
            category_id = int(p.pop("category"))

            # Update account balance
            account = Account.objects.get(pk=account_id)
            account.amount = round(account.amount, 2) + value
            account.save()

            # Set transaction details
            transaction_data["to_account"] = account_id
            transaction_data["category"] = category_id

        # Create and save the transaction
        serializer = TransactionSerializer(data=transaction_data)
        if not serializer.is_valid():
            raise Exception(f"{serializer.errors}")

        serializer.save()

        return Response(
            {"message": "Transaction Added."}, status=status.HTTP_201_CREATED
        )
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["POST"])
def delete_transaction(request):
    p = request.data

    try:
        transaction_id = int(p["id"])
        transaction_type = p[
            "type"
        ]  # Now this will be 'income', 'expense', or 'transfer'

        # Get the transaction
        transaction = Transaction.objects.get(id=transaction_id)

        if transaction.transaction_type == "transfer":
            # Handle transfer deletion
            from_account = Account.objects.get(id=transaction.from_account.id)
            to_account = Account.objects.get(id=transaction.to_account.id)

            if not from_account.deleted:
                from_account.amount = (
                    round(from_account.amount, 2) + transaction.amount
                )
                from_account.save()

            if not to_account.deleted:
                to_account.amount = (
                    round(to_account.amount, 2) - transaction.amount
                )
                to_account.save()

        elif transaction.transaction_type == "expense":
            # Handle expense deletion - increase account balance
            account = Account.objects.get(id=transaction.from_account.id)
            if not account.deleted:
                account.amount = round(account.amount, 2) + transaction.amount
                account.save()

        elif transaction.transaction_type == "income":
            # Handle income deletion - decrease account balance
            account = Account.objects.get(id=transaction.to_account.id)
            if not account.deleted:
                account.amount = round(account.amount, 2) - transaction.amount
                account.save()
        else:
            raise Exception("Incorrect transaction type.")

        # Delete the transaction
        transaction.delete()
        return Response(
            {"msg": "Transaction deleted"}, status=status.HTTP_200_OK
        )

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
def get_all_transactions(request):
    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    transactions = Transaction.objects.filter(user_id=user_id)
    serializer = TransactionSerializer(transactions, many=True)

    # Group transactions by type for backward compatibility
    response_data = {
        "incomes": [
            t for t in serializer.data if t["transaction_type"] == "income"
        ],
        "expenses": [
            t for t in serializer.data if t["transaction_type"] == "expense"
        ],
        "transfers": [
            t for t in serializer.data if t["transaction_type"] == "transfer"
        ],
    }

    return Response(response_data, status=status.HTTP_200_OK)


@api_view(["GET"])
def get_income_categories(request):
    categories = TransactionCategory.objects.filter(category_type=0)
    serializer = TransactionCategorySerializer(categories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
def get_expense_categories(request):
    categories = TransactionCategory.objects.filter(category_type=1)
    serializer = TransactionCategorySerializer(categories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
def get_all_expenses(request):
    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    results = Transaction.objects.filter(
        user_id=user_id, transaction_type="expense"
    )
    serializer = TransactionSerializer(results, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
def get_all_incomes(request):
    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    results = Transaction.objects.filter(
        user_id=user_id, transaction_type="income"
    )
    serializer = TransactionSerializer(results, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
def get_all_transfers(request):
    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    results = Transaction.objects.filter(
        user_id=user_id, transaction_type="transfer"
    )
    serializer = TransactionSerializer(results, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)
