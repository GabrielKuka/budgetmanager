from .models import DimAccount
from rest_framework import serializers


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = DimAccount
        fields = "__all__"
