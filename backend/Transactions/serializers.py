from decimal import Decimal

from rest_framework import serializers

from Accounts.models import Account, CashBalance, Currency, Holding, Security
from tags.models import Tag
from tags.serializers import TagSerializer

from .models import Transaction, TransactionCategory


class TransactionCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionCategory
        fields = "__all__"


class TransactionReadSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)
    amount = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    from_account = serializers.SerializerMethodField()
    to_account = serializers.SerializerMethodField()
    account = serializers.SerializerMethodField()
    from_cash_balance = serializers.SerializerMethodField()
    to_cash_balance = serializers.SerializerMethodField()
    security = serializers.SerializerMethodField()
    security_ticker = serializers.SerializerMethodField()
    security_name = serializers.SerializerMethodField()
    holding = serializers.SerializerMethodField()
    quantity = serializers.SerializerMethodField()
    price_per_unit = serializers.SerializerMethodField()
    fx_rate = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = (
            "id",
            "user",
            "transaction_type",
            "date",
            "description",
            "created_on",
            "tags",
            "amount",
            "category",
            "from_account",
            "to_account",
            "account",
            "from_cash_balance",
            "to_cash_balance",
            "security",
            "security_ticker",
            "security_name",
            "holding",
            "quantity",
            "price_per_unit",
            "fx_rate",
            "pinned",
        )

    def _income_detail(self, obj):
        return getattr(obj, "income_detail", None)

    def _expense_detail(self, obj):
        return getattr(obj, "expense_detail", None)

    def _transfer_detail(self, obj):
        return getattr(obj, "transfer_detail", None)

    def _security_trade_detail(self, obj):
        return getattr(obj, "security_trade_detail", None)

    def get_amount(self, obj):
        if obj.transaction_type == "income":
            detail = self._income_detail(obj)
            return float(detail.amount) if detail else None

        if obj.transaction_type == "expense":
            detail = self._expense_detail(obj)
            return float(detail.amount) if detail else None

        if obj.transaction_type == "transfer":
            detail = self._transfer_detail(obj)
            return float(detail.amount) if detail else None

        if obj.transaction_type in ("buy", "sell"):
            detail = self._security_trade_detail(obj)
            return float(detail.total_value) if detail else None

        return None

    def get_category(self, obj):
        if obj.transaction_type == "income":
            detail = self._income_detail(obj)
            return detail.category_id if detail else None

        if obj.transaction_type == "expense":
            detail = self._expense_detail(obj)
            return detail.category_id if detail else None

        return None

    def get_from_account(self, obj):
        if obj.transaction_type == "expense":
            detail = self._expense_detail(obj)
            return detail.from_cash_balance.account_id if detail else None

        if obj.transaction_type == "transfer":
            detail = self._transfer_detail(obj)
            return detail.from_cash_balance.account_id if detail else None

        if obj.transaction_type == "buy":
            detail = self._security_trade_detail(obj)
            return detail.cash_balance.account_id if detail else None

        return None

    def get_to_account(self, obj):
        if obj.transaction_type == "income":
            detail = self._income_detail(obj)
            return detail.to_cash_balance.account_id if detail else None

        if obj.transaction_type == "transfer":
            detail = self._transfer_detail(obj)
            return detail.to_cash_balance.account_id if detail else None

        if obj.transaction_type == "sell":
            detail = self._security_trade_detail(obj)
            return detail.cash_balance.account_id if detail else None

        return None

    def get_account(self, obj):
        if obj.transaction_type == "income":
            return self.get_to_account(obj)
        if obj.transaction_type in ("expense", "buy"):
            return self.get_from_account(obj)
        if obj.transaction_type == "sell":
            return self.get_to_account(obj)
        return None

    def get_from_cash_balance(self, obj):
        if obj.transaction_type == "expense":
            detail = self._expense_detail(obj)
            return detail.from_cash_balance_id if detail else None
        if obj.transaction_type == "transfer":
            detail = self._transfer_detail(obj)
            return detail.from_cash_balance_id if detail else None
        if obj.transaction_type == "buy":
            detail = self._security_trade_detail(obj)
            return detail.cash_balance_id if detail else None
        return None

    def get_to_cash_balance(self, obj):
        if obj.transaction_type == "income":
            detail = self._income_detail(obj)
            return detail.to_cash_balance_id if detail else None
        if obj.transaction_type == "transfer":
            detail = self._transfer_detail(obj)
            return detail.to_cash_balance_id if detail else None
        if obj.transaction_type == "sell":
            detail = self._security_trade_detail(obj)
            return detail.cash_balance_id if detail else None
        return None

    def get_security(self, obj):
        detail = self._security_trade_detail(obj)
        return detail.security_id if detail else None

    def get_security_ticker(self, obj):
        detail = self._security_trade_detail(obj)
        if detail and detail.security_id:
            return detail.security.ticker
        return None

    def get_security_name(self, obj):
        detail = self._security_trade_detail(obj)
        if detail and detail.security_id:
            return detail.security.name
        return None

    def get_holding(self, obj):
        detail = self._security_trade_detail(obj)
        return detail.holding_id if detail else None

    def get_quantity(self, obj):
        detail = self._security_trade_detail(obj)
        return float(detail.quantity) if detail else None

    def get_price_per_unit(self, obj):
        detail = self._security_trade_detail(obj)
        return float(detail.price_per_unit) if detail else None

    def get_fx_rate(self, obj):
        detail = self._transfer_detail(obj)
        return float(detail.fx_rate) if detail else None


class TransactionWriteSerializer(serializers.Serializer):
    transaction_type = serializers.CharField(required=False, allow_blank=True)
    type = serializers.CharField(required=False, allow_blank=True)
    date = serializers.DateField(required=True)
    description = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )
    tags = serializers.ListField(required=False, allow_empty=True)

    amount = serializers.DecimalField(
        required=False,
        max_digits=19,
        decimal_places=8,
    )
    from_amount = serializers.DecimalField(
        required=False,
        max_digits=19,
        decimal_places=8,
    )
    to_amount = serializers.DecimalField(
        required=False,
        max_digits=19,
        decimal_places=8,
    )
    fx_rate = serializers.DecimalField(
        required=False,
        max_digits=19,
        decimal_places=8,
    )

    category = serializers.IntegerField(required=False, allow_null=True)
    from_account = serializers.IntegerField(required=False)
    to_account = serializers.IntegerField(required=False)
    from_cash_balance = serializers.IntegerField(required=False)
    to_cash_balance = serializers.IntegerField(required=False)
    currency = serializers.CharField(required=False, allow_blank=True)
    from_currency = serializers.CharField(required=False, allow_blank=True)
    to_currency = serializers.CharField(required=False, allow_blank=True)

    security = serializers.CharField(required=False, allow_blank=True)
    holding = serializers.IntegerField(required=False, allow_null=True)
    quantity = serializers.DecimalField(
        required=False,
        max_digits=19,
        decimal_places=8,
    )
    price_per_unit = serializers.DecimalField(
        required=False,
        max_digits=19,
        decimal_places=8,
    )

    def _user(self):
        user = self.context.get("user")
        if user is None:
            raise serializers.ValidationError(
                "Serializer context must include user."
            )
        return user

    def _normalize_type(self, attrs):
        raw_type = attrs.get("transaction_type")
        if raw_type in (None, ""):
            raw_type = attrs.get("type")

        type_map = {
            "0": "income",
            "1": "expense",
            "2": "transfer",
            "3": "buy",
            "4": "sell",
            0: "income",
            1: "expense",
            2: "transfer",
            3: "buy",
            4: "sell",
        }
        tx_type = type_map.get(raw_type, raw_type)

        valid = {value for value, _ in Transaction.TRANSACTION_TYPES}
        if tx_type not in valid:
            raise serializers.ValidationError(
                {"transaction_type": f"Invalid transaction type: {raw_type!r}"}
            )
        return tx_type

    def _resolve_currency(self, raw_value, field_name):
        if raw_value in (None, ""):
            return None

        if isinstance(raw_value, int) or (
            isinstance(raw_value, str) and raw_value.isdigit()
        ):
            currency = Currency.objects.filter(pk=int(raw_value)).first()
        else:
            code = str(raw_value).strip().upper()
            currency = Currency.objects.filter(code=code).first()

        if not currency:
            raise serializers.ValidationError(
                {field_name: f"Currency {raw_value!r} does not exist."}
            )
        return currency

    def _resolve_account(self, account_id, field_name):
        user = self._user()
        account = Account.objects.filter(pk=account_id, user=user).first()
        if not account:
            raise serializers.ValidationError(
                {field_name: f"Account {account_id!r} not found for user."}
            )
        return account

    def _resolve_cash_balance(
        self,
        attrs,
        balance_field,
        account_field,
        currency_field,
    ):
        user = self._user()
        balance_id = attrs.get(balance_field)

        if balance_id not in (None, ""):
            cash_balance = (
                CashBalance.objects.select_related("account", "currency")
                .filter(
                    pk=int(balance_id),
                    account__user=user,
                )
                .first()
            )
            if not cash_balance:
                raise serializers.ValidationError(
                    {
                        balance_field: f"Cash balance {balance_id!r} not found for user."
                    }
                )
            return cash_balance

        account_id = attrs.get(account_field)
        if account_id in (None, ""):
            raise serializers.ValidationError(
                {
                    balance_field: (
                        f"Provide {balance_field} or {account_field}."
                    )
                }
            )

        account = self._resolve_account(int(account_id), account_field)
        account_balances = CashBalance.objects.select_related(
            "currency"
        ).filter(account=account)
        count = account_balances.count()

        currency = self._resolve_currency(
            attrs.get(currency_field), currency_field
        )
        if currency:
            cash_balance = account_balances.filter(currency=currency).first()
            if cash_balance:
                return cash_balance
            return CashBalance.objects.create(
                account=account,
                currency=currency,
                balance=Decimal("0"),
            )

        if count == 1:
            return account_balances.first()

        if count == 0:
            raise serializers.ValidationError(
                {
                    balance_field: (
                        f"Account {account.id} has no cash balances. "
                        f"Provide {currency_field}."
                    )
                }
            )

        raise serializers.ValidationError(
            {
                balance_field: (
                    f"Account {account.id} has multiple cash balances. "
                    f"Provide {balance_field} or {currency_field}."
                )
            }
        )

    def _resolve_tags(self, tags_data):
        if tags_data in (None, ""):
            return []
        if not isinstance(tags_data, list):
            raise serializers.ValidationError({"tags": "Tags must be a list."})

        resolved = []
        for item in tags_data:
            if isinstance(item, dict):
                name = str(item.get("name", "")).strip()
                if not name:
                    continue
                tag, _ = Tag.objects.get_or_create(name=name)
                resolved.append(tag)
                continue

            if isinstance(item, int) or (
                isinstance(item, str) and item.isdigit()
            ):
                tag = Tag.objects.filter(pk=int(item)).first()
                if not tag:
                    raise serializers.ValidationError(
                        {"tags": f"Tag id {item!r} does not exist."}
                    )
                resolved.append(tag)
                continue

            name = str(item).strip()
            if not name:
                continue
            tag, _ = Tag.objects.get_or_create(name=name)
            resolved.append(tag)

        # Keep order and remove duplicates by id.
        uniq = []
        seen = set()
        for tag in resolved:
            if tag.id in seen:
                continue
            seen.add(tag.id)
            uniq.append(tag)
        return uniq

    def _resolve_category(self, tx_type, category_id):
        if category_id in (None, ""):
            return None

        category = TransactionCategory.objects.filter(
            pk=int(category_id)
        ).first()
        if not category:
            raise serializers.ValidationError(
                {"category": f"Category {category_id!r} does not exist."}
            )

        expected = None
        if tx_type == "income":
            expected = 0
        elif tx_type == "expense":
            expected = 1

        if expected is not None and category.category_type != expected:
            type_name = "income" if expected == 0 else "expense"
            raise serializers.ValidationError(
                {
                    "category": f"Category {category.id} is not a {type_name} category."
                }
            )
        return category

    def _require_positive(self, value, field_name):
        if value in (None, ""):
            raise serializers.ValidationError(
                {field_name: "This field is required."}
            )
        if Decimal(value) <= 0:
            raise serializers.ValidationError(
                {field_name: "Must be greater than zero."}
            )
        return Decimal(value)

    def _resolve_holding(self, holding_id):
        if holding_id in (None, ""):
            return None
        user = self._user()
        holding = (
            Holding.objects.select_related("account", "security")
            .filter(
                pk=int(holding_id),
                account__user=user,
            )
            .first()
        )
        if not holding:
            raise serializers.ValidationError(
                {"holding": f"Holding {holding_id!r} not found for user."}
            )
        return holding

    def _resolve_security(
        self,
        security_id,
        *,
        default_currency=None,
        create_if_missing=False,
    ):
        if security_id in (None, ""):
            return None
        security = None
        if isinstance(security_id, int) or (
            isinstance(security_id, str) and security_id.isdigit()
        ):
            security = Security.objects.filter(pk=int(security_id)).first()
        else:
            ticker = str(security_id).strip().upper()
            security = Security.objects.filter(ticker__iexact=ticker).first()
            if not security and create_if_missing:
                if default_currency is None:
                    raise serializers.ValidationError(
                        {
                            "security": (
                                "Cannot auto-create security without a currency context."
                            )
                        }
                    )
                security = Security.objects.create(
                    name=ticker,
                    ticker=ticker,
                    currency=default_currency,
                )
        if not security:
            raise serializers.ValidationError(
                {
                    "security": (
                        f"Security {security_id!r} does not exist. "
                        "Use existing ticker or security id."
                    )
                }
            )
        return security

    def validate(self, attrs):
        tx_type = self._normalize_type(attrs)

        normalized = {
            "resolved_type": tx_type,
            "description": attrs.get("description") or "",
            "date": attrs["date"],
            "resolved_tags": self._resolve_tags(attrs.get("tags", [])),
            "resolved_category": self._resolve_category(
                tx_type, attrs.get("category")
            ),
        }

        if tx_type == "income":
            normalized["resolved_amount"] = self._require_positive(
                attrs.get("amount"),
                "amount",
            )
            normalized["resolved_to_cash_balance"] = (
                self._resolve_cash_balance(
                    attrs,
                    balance_field="to_cash_balance",
                    account_field="to_account",
                    currency_field="currency",
                )
            )

        elif tx_type == "expense":
            normalized["resolved_amount"] = self._require_positive(
                attrs.get("amount"),
                "amount",
            )
            normalized["resolved_from_cash_balance"] = (
                self._resolve_cash_balance(
                    attrs,
                    balance_field="from_cash_balance",
                    account_field="from_account",
                    currency_field="currency",
                )
            )

        elif tx_type == "transfer":
            from_amount = attrs.get("from_amount", attrs.get("amount"))
            normalized["resolved_from_amount"] = self._require_positive(
                from_amount,
                "from_amount",
            )
            normalized["resolved_from_cash_balance"] = (
                self._resolve_cash_balance(
                    attrs,
                    balance_field="from_cash_balance",
                    account_field="from_account",
                    currency_field="from_currency",
                )
            )
            normalized["resolved_to_cash_balance"] = (
                self._resolve_cash_balance(
                    attrs,
                    balance_field="to_cash_balance",
                    account_field="to_account",
                    currency_field="to_currency",
                )
            )

            if (
                normalized["resolved_from_cash_balance"].id
                == normalized["resolved_to_cash_balance"].id
            ):
                raise serializers.ValidationError(
                    {
                        "to_cash_balance": "Transfer source and destination cannot be the same."
                    }
                )

            fx_rate = attrs.get("fx_rate")
            if fx_rate in (None, ""):
                to_amount = attrs.get("to_amount")
                if to_amount not in (None, ""):
                    to_amount = self._require_positive(to_amount, "to_amount")
                    fx_rate = to_amount / normalized["resolved_from_amount"]
                else:
                    fx_rate = Decimal("1")
            fx_rate = Decimal(str(fx_rate))
            if fx_rate <= 0:
                raise serializers.ValidationError(
                    {"fx_rate": "Must be greater than zero."}
                )
            normalized["resolved_fx_rate"] = fx_rate

        elif tx_type == "buy":
            normalized["resolved_from_cash_balance"] = (
                self._resolve_cash_balance(
                    attrs,
                    balance_field="from_cash_balance",
                    account_field="from_account",
                    currency_field="from_currency",
                )
            )
            security = self._resolve_security(
                attrs.get("security"),
                default_currency=normalized[
                    "resolved_from_cash_balance"
                ].currency,
                create_if_missing=True,
            )
            if not security:
                raise serializers.ValidationError(
                    {"security": "This field is required."}
                )

            quantity = self._require_positive(
                attrs.get("quantity"), "quantity"
            )
            amount = attrs.get("amount")
            ppu = attrs.get("price_per_unit")
            if ppu in (None, "") and amount in (None, ""):
                raise serializers.ValidationError(
                    {
                        "price_per_unit": (
                            "Provide price_per_unit or amount for buy transactions."
                        )
                    }
                )
            if ppu in (None, ""):
                amount = self._require_positive(amount, "amount")
                ppu = amount / quantity
            ppu = Decimal(str(ppu))
            if ppu <= 0:
                raise serializers.ValidationError(
                    {"price_per_unit": "Must be greater than zero."}
                )

            holding = self._resolve_holding(attrs.get("holding"))
            if holding and holding.security_id != security.id:
                raise serializers.ValidationError(
                    {
                        "holding": "Holding security does not match provided security."
                    }
                )

            normalized["resolved_security"] = security
            normalized["resolved_holding"] = holding
            normalized["resolved_quantity"] = quantity
            normalized["resolved_price_per_unit"] = ppu

        elif tx_type == "sell":
            holding = self._resolve_holding(attrs.get("holding"))
            if not holding:
                raise serializers.ValidationError(
                    {"holding": "This field is required."}
                )

            normalized["resolved_to_cash_balance"] = (
                self._resolve_cash_balance(
                    attrs,
                    balance_field="to_cash_balance",
                    account_field="to_account",
                    currency_field="to_currency",
                )
            )
            quantity = self._require_positive(
                attrs.get("quantity"), "quantity"
            )
            if quantity > holding.quantity:
                raise serializers.ValidationError(
                    {
                        "quantity": (
                            f"Cannot sell {quantity}; holding has {holding.quantity}."
                        )
                    }
                )

            amount = attrs.get("amount")
            ppu = attrs.get("price_per_unit")
            if ppu in (None, "") and amount in (None, ""):
                raise serializers.ValidationError(
                    {
                        "price_per_unit": (
                            "Provide price_per_unit or amount for sell transactions."
                        )
                    }
                )
            if ppu in (None, ""):
                amount = self._require_positive(amount, "amount")
                ppu = amount / quantity
            ppu = Decimal(str(ppu))
            if ppu <= 0:
                raise serializers.ValidationError(
                    {"price_per_unit": "Must be greater than zero."}
                )

            normalized["resolved_holding"] = holding
            normalized["resolved_security"] = holding.security
            normalized["resolved_quantity"] = quantity
            normalized["resolved_price_per_unit"] = ppu

        return normalized
