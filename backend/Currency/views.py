from decimal import Decimal

from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view
from rest_framework.response import Response

from Accounts.models import Account
from Currency.services import MissingExchangeRate, convert_amount


@api_view(["GET"])
def convert(request, base: str, to: str, amount: float) -> Response:
    try:
        converted = convert_amount(amount, base, to, None)
    except MissingExchangeRate as exc:
        return Response(
            {"error": "Failed to convert currencies", "message": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {
            "base_code": base.upper(),
            "target_code": to.upper(),
            "conversion_result": float(converted),
        }
    )


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

    total = Decimal("0")

    for a in filtered_accounts:
        try:
            total += convert_amount(a.amount, a.currency, currency, None)
        except MissingExchangeRate as exc:
            return Response(
                {
                    "error": f"Failed to convert currencies for account {a.name} with base currency {a.currency}",
                    "message": str(exc),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    return Response({"amount": float(total)}, status=status.HTTP_200_OK)
