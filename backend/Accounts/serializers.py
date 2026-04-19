from rest_framework import serializers

from .models import (
    Account,
    CashBalance,
    Currency,
    Holding,
    Security,
    SecurityPrice,
)


class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = (
            "id",
            "code",
            "name",
            "symbol",
            "currency_type",
            "exchange_rate_regime",
            "is_active",
            "created_on",
            "updated_on",
        )
        read_only_fields = ("id", "created_on", "updated_on")

    def validate_code(self, value):
        return value.strip().upper()


class SecurityPriceSerializer(serializers.ModelSerializer):
    security_id = serializers.PrimaryKeyRelatedField(
        source="security",
        queryset=Security.objects.all(),
        write_only=True,
    )

    class Meta:
        model = SecurityPrice
        fields = (
            "id",
            "security",
            "security_id",
            "date",
            "price",
            "source",
            "created_on",
        )
        read_only_fields = ("id", "security", "created_on")


class SecuritySerializer(serializers.ModelSerializer):
    currency = CurrencySerializer(read_only=True)
    currency_id = serializers.PrimaryKeyRelatedField(
        source="currency",
        queryset=Currency.objects.all(),
        write_only=True,
    )
    latest_price = serializers.SerializerMethodField()

    def get_latest_price(self, obj):
        latest_price = obj.prices.first()
        if latest_price is None:
            return None
        return SecurityPriceSerializer(latest_price).data

    class Meta:
        model = Security
        fields = (
            "id",
            "isin",
            "structure",
            "asset_class",
            "name",
            "ticker",
            "currency",
            "currency_id",
            "latest_price",
            "description",
            "created_on",
            "updated_on",
        )
        read_only_fields = ("id", "created_on", "updated_on")

    def validate_isin(self, value):
        return value.strip().upper() if value else value

    def validate_ticker(self, value):
        return value.strip().upper()


class CashBalanceSerializer(serializers.ModelSerializer):
    account_id = serializers.PrimaryKeyRelatedField(
        source="account",
        queryset=Account.objects.all(),
        write_only=True,
    )
    currency = CurrencySerializer(read_only=True)
    currency_id = serializers.PrimaryKeyRelatedField(
        source="currency",
        queryset=Currency.objects.all(),
        write_only=True,
    )

    class Meta:
        model = CashBalance
        fields = (
            "id",
            "account",
            "account_id",
            "currency",
            "currency_id",
            "balance",
            "created_on",
            "updated_on",
        )
        read_only_fields = ("id", "account", "created_on", "updated_on")


class HoldingSerializer(serializers.ModelSerializer):
    account_id = serializers.PrimaryKeyRelatedField(
        source="account",
        queryset=Account.objects.all(),
        write_only=True,
    )
    security = SecuritySerializer(read_only=True)
    security_id = serializers.PrimaryKeyRelatedField(
        source="security",
        queryset=Security.objects.all(),
        write_only=True,
    )
    latest_price = serializers.SerializerMethodField()
    cost_basis = serializers.DecimalField(
        max_digits=38,
        decimal_places=16,
        read_only=True,
    )
    market_value = serializers.SerializerMethodField()
    unrealized_gain = serializers.SerializerMethodField()

    def _latest_price(self, obj):
        return obj.security.prices.first()

    def get_latest_price(self, obj):
        latest_price = self._latest_price(obj)
        if latest_price is None:
            return None
        return SecurityPriceSerializer(latest_price).data

    def get_market_value(self, obj):
        latest_price = self._latest_price(obj)
        if latest_price is None:
            return None
        return obj.quantity * latest_price.price

    def get_unrealized_gain(self, obj):
        market_value = self.get_market_value(obj)
        if market_value is None:
            return None
        return market_value - obj.cost_basis

    class Meta:
        model = Holding
        fields = (
            "id",
            "account",
            "account_id",
            "security",
            "security_id",
            "quantity",
            "average_cost",
            "latest_price",
            "cost_basis",
            "market_value",
            "unrealized_gain",
            "created_on",
            "updated_on",
        )
        read_only_fields = ("id", "account", "created_on", "updated_on")


class AccountSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(
        source="get_type_display",
        read_only=True,
    )
    amount = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()
    cash_balances = CashBalanceSerializer(many=True, read_only=True)
    holdings = HoldingSerializer(many=True, read_only=True)

    def _primary_cash_balance(self, obj):
        balances = list(obj.cash_balances.all())
        if not balances:
            return None
        eur_balance = next(
            (
                balance
                for balance in balances
                if balance.currency.code == "EUR"
            ),
            None,
        )
        return eur_balance or balances[0]

    def get_amount(self, obj):
        balance = self._primary_cash_balance(obj)
        if balance is None:
            return 0.0
        return float(balance.balance)

    def get_currency(self, obj):
        balance = self._primary_cash_balance(obj)
        if balance is None:
            return None
        return balance.currency.code

    class Meta:
        model = Account
        fields = (
            "id",
            "user",
            "type",
            "type_display",
            "name",
            "amount",
            "currency",
            "deleted",
            "cash_balances",
            "holdings",
            "created_on",
            "updated_on",
        )
        read_only_fields = ("id", "user", "created_on", "updated_on")
