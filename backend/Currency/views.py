import requests
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view
from rest_framework.response import Response

from Accounts.models import Account

BASE_URL = "https://v6.exchangerate-api.com/v6"
API_KEY = "c5bb0807f5e382a4275da6eb"


@api_view(["GET"])
def convert(request, base: str, to: str, amount: float) -> Response:
    amount = float(amount)

    response = requests.get(
        url=f"{BASE_URL}/{API_KEY}/pair/{base}/{to}/{amount}"
    )

    if response.status_code >= 400:
        return Response(
            {
                "error": "Failed to convert currencies",
                "message": response.text,
            },
            status=response.status_code,
        )

    return Response(response.json())


@api_view(["GET"])
def convert_account_currency_on_type(request, currency, type):
    if type not in {0, 1, 2}:
        return Response(
            {"error": "Wrong account type. Allowed values: 0,1,2"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    filtered_accounts = Account.objects.filter(type=type, user_id=user_id)

    total = 0

    for a in filtered_accounts:
        # If it's the same currency don't make request
        if currency == a.currency:
            total += a.amount
            continue

        response = requests.get(
            url=f"{BASE_URL}/{API_KEY}/pair/{a.currency}/{currency}/{a.amount}"
        )

        if response.status_code != 200:
            return Response(
                {
                    "error": f"Failed to convert currencies for account {a.name} with base currency {a.currency}",
                    "message": response.text,
                },
                status=response.status_code,
            )

        converted_amount = response.json()["conversion_result"]
        total += converted_amount

    return Response({"amount": total}, status=status.HTTP_200_OK)
