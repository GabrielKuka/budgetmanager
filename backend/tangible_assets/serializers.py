from decimal import Decimal

from rest_framework import serializers

from Accounts.models import Currency

from .models import TangibleAsset, TangibleAssetValuation, Unit


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ("id", "code", "name", "symbol", "dimension")


class CurrencyBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = ("id", "code", "name", "symbol")


class TangibleAssetValuationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TangibleAssetValuation
        fields = ("id", "date", "value", "notes", "source", "created_on")
        read_only_fields = ("id", "source", "created_on")


class TangibleAssetSerializer(serializers.ModelSerializer):
    currency = CurrencyBriefSerializer(read_only=True)
    currency_id = serializers.PrimaryKeyRelatedField(
        source="currency", queryset=Currency.objects.all(), write_only=True
    )
    unit = UnitSerializer(read_only=True)
    unit_id = serializers.PrimaryKeyRelatedField(
        source="unit",
        queryset=Unit.objects.filter(is_active=True),
        write_only=True,
        required=False,
        allow_null=True,
    )
    latest_valuation = serializers.SerializerMethodField()
    current_value = serializers.SerializerMethodField()
    asset_type_display = serializers.CharField(
        source="get_asset_type_display", read_only=True
    )
    property_type_display = serializers.CharField(
        source="get_property_type_display", read_only=True
    )

    class Meta:
        model = TangibleAsset
        fields = (
            "id",
            "name",
            "asset_type",
            "asset_type_display",
            "property_type",
            "property_type_display",
            "address",
            "unit",
            "unit_id",
            "quantity",
            "purity",
            "acquired_on",
            "acquisition_cost",
            "currency",
            "currency_id",
            "notes",
            "status",
            "disposed_on",
            "disposal_reason",
            "latest_valuation",
            "current_value",
            "created_on",
            "updated_on",
        )
        read_only_fields = (
            "id",
            "status",
            "disposed_on",
            "disposal_reason",
            "latest_valuation",
            "current_value",
            "created_on",
            "updated_on",
        )

    def get_latest_valuation(self, obj):
        valuation = next(
            (
                row
                for row in obj.valuations.all()
                if row.date <= self.context["today"]
            ),
            None,
        )
        return (
            TangibleAssetValuationSerializer(valuation).data
            if valuation
            else None
        )

    def get_current_value(self, obj):
        valuation = next(
            (
                row
                for row in obj.valuations.all()
                if row.date <= self.context["today"]
            ),
            None,
        )
        return valuation.value if valuation else Decimal(obj.acquisition_cost)

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        immutable = ("currency", "acquired_on", "acquisition_cost")
        if instance and any(field in attrs for field in immutable):
            raise serializers.ValidationError(
                "Acquisition date, cost, and currency are immutable."
            )
        candidate = instance or TangibleAsset(
            user=self.context["request"].user
        )
        for field, value in attrs.items():
            setattr(candidate, field, value)
        candidate.full_clean()
        return attrs
