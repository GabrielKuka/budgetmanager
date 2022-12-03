from rest_framework import serializers

from .models import FactTransaction, DimExpenseCategory, DimIncomeCategory
from Users.serializers import UserSerializer
from Users.models import User


class TransactionSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()

    class Meta:
        model = FactTransaction
        fields = "__all__"

    def create(self, validated_data):
        print(validated_data)
        user_id = validated_data.pop("user_id")
        t = FactTransaction(**validated_data)
        t.user = User.objects.get(id=user_id)
        t.save()
        return t

    def to_representaion(self, instance):
        response = super().to_representation(instance)
        response["user"] = UserSerializer(instance.user).data


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DimExpenseCategory
        fields = "__all__"


class IncomeCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DimIncomeCategory
        fields = "__all__"
