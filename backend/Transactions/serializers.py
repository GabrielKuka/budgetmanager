from rest_framework import serializers

from tags.serializers import TagSerializer

from .models import (
    Expense,
    Income,
    Transfer,
    TransactionCategory,
)
from tags.models import Tag


class IncomeSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()
    tags = TagSerializer(many=True, required=False)

    class Meta:
        model = Income
        fields = "__all__"

    def create(self, validated_data):
        tags_data = validated_data.pop("tags", [])
        income = Income.objects.create(**validated_data)
        for tag_data in tags_data:
            tag, _ = Tag.objects.get_or_create(name=tag_data["name"])
            income.tags.add(tag)

        return income


class ExpenseSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()
    tags = TagSerializer(many=True, required=False)

    class Meta:
        model = Expense
        fields = "__all__"

    def create(self, validated_data):
        tags_data = validated_data.pop("tags", [])
        expense = Expense.objects.create(**validated_data)
        for tag_data in tags_data:
            tag, _ = Tag.objects.get_or_create(name=tag_data["name"])
            expense.tags.add(tag)

        return expense


class TransferSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()
    tags = TagSerializer(many=True, required=False)

    class Meta:
        model = Transfer
        fields = "__all__"

    def create(self, validated_data):
        tags_data = validated_data.pop("tags", [])
        transfer = Transfer.objects.create(**validated_data)
        for tag_data in tags_data:
            tag, _ = Tag.objects.get_or_create(name=tag_data["name"])
            transfer.tags.add(tag)

        return transfer


class TransactionCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionCategory
        fields = "__all__"
