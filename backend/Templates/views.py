from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Template, TemplateGroup
from .serialzers import TemplateGroupSerializer, TemplateSerializer


@api_view(["GET"])
def get_template_groups(request):
    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    results = TemplateGroup.objects.filter(user_id=user_id)

    serializer = TemplateGroupSerializer(results, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
def add_template_group(request):
    # Retrieve Token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    p = request.data
    p["user_id"] = user_id

    try:
        TemplateGroup(**p).save()

        return Response(
            {"message": "Template group added"}, status=status.HTTP_201_CREATED
        )
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["DELETE"])
def delete_template_group(request, id):
    # Retrieve user token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id

    try:
        TemplateGroup.objects.filter(pk=id).delete()
        return Response(
            {"message": "Template group deleted."}, status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["POST"])
def add_template(request):
    # Retrieve user token
    token = request.headers["Authorization"]
    user_id = Token.objects.get(key=token).user_id
    p = request.data
    p["user_id"] = user_id

    p["type"] = int(p["type"])
    p["amount"] = round(float(p["amount"]), 2)
    try:
        if p["type"] in {0, 1}:  # <- Income or Expense
            p.pop("from_account")
            p.pop("to_account")
            p["account"] = int(p["account"])
            p["category"] = int(p["category"])
        elif p["type"] == 2:  # <- Transfer
            p.pop("account")
            p.pop("category")
            p["from_account"] = int(p["from_account"])
            p["to_account"] = int(p["to_account"])
        else:
            raise Exception("Invalid input.")

        serializer = TemplateSerializer(data=p)
        if not serializer.is_valid():
            raise Exception(f"{serializer.errors}")

        serializer.save(user_id=user_id, template_group_id=p["template_group"])

        # Template(**p).save()
        return Response(
            {"message": "Template created."}, status=status.HTTP_201_CREATED
        )
    except Exception as e:
        return Response(
            {"error": str(e)},
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
