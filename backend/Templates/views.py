from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.authtoken.models import Token

from .models import Template
from .serialzers import TemplateSerializer


@api_view(["POST"])
def add_template(request):

    # Retrieve user token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id
    p = request.data
    p["user_id"] = user_id

    try:
        Template(**p).save()
        return Response(
            {"message": "Template created."}, status=status.HTTP_201_CREATED
        )
    except:
        return Response(
            {"error": "Error creating template."},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["DELETE"])
def delete_template(request, id):
    # Retrieve user token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    try:
        Template.objects.filter(pk=id).delete()
        return Response(
            {"message": "Account deleted."}, status=status.HTTP_200_OK
        )
    except:
        return Response(
            {"error": "Error deleting template."},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["PATCH"])
def update_template(request):
    pass


@api_view(["GET"])
def get_templates(request):

    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    results = Template.objects.filter(user_id=user_id)

    serializer = TemplateSerializer(results, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)
