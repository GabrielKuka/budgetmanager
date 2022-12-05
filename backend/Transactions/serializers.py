from rest_framework import serializers

from .models import ExpenseCategory, IncomeCategory, Income, Expense, Transfer
from Users.serializers import UserSerializer
from Users.models import User



class IncomeSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()

    class Meta:
        model = Income 
        fields = "__all__"

class ExpenseSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()

    class Meta:
        model = Expense 
        fields = "__all__"

class TransferSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()

    class Meta:
        model = Transfer 
        fields = "__all__"


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = "__all__"


class IncomeCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = IncomeCategory
        fields = "__all__"
