from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.authtoken.models import Token

from .models import DimAccount
from .serialzers import AccountSerializer


@api_view(["POST"])
def create_account(request):

    # Retrieve user token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id
    p = request.data
    p["user_id"] = user_id

    try:
        DimAccount(**p).save()
        return Response(
            {"message": "Account created."}, status=status.HTTP_201_CREATED
        )
    except:
        return Response(
            {"error": "Error creating account."},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["GET"])
def get_all_accounts(request):

    # Retrieve user token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    accounts = DimAccount.objects.filter(user=user_id)

    serializer = AccountSerializer(accounts, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)
