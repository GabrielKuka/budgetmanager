from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Account
from django.shortcuts import get_object_or_404, redirect
from .serialzers import AccountSerializer


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
