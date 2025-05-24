from rest_framework import serializers

from Accounts.serialzers import AccountSerializer
from tags.serializers import TagSerializer

from .models import TransactionCategory, Transaction
from tags.models import Tag


class TransactionSerializer(serializers.ModelSerializer):
    user_id = serializers.StringRelatedField()
    tags = TagSerializer(many=True, required=False)

    class Meta:
        model = Transaction
        fields = "__all__"

    def create(self, validated_data):
        tags_data = validated_data.pop("tags", [])
        transactions = Transaction.objects.create(**validated_data)
        for tag_data in tags_data:
            tag, _ = Tag.objects.get_or_create(name=tag_data["name"])
            transactions.tags.add(tag)

        return transactions


class FoodTransactionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    date = serializers.DateField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    description = serializers.CharField(allow_null=True)
    tags = serializers.ListField(
        child=serializers.CharField(), allow_empty=True
    )


class TransactionCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionCategory
        fields = "__all__"
