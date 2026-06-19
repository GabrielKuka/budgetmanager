from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q

from Accounts.models import Account, CashBalance, Holding, Security
from tags.models import Tag


class TransactionCategory(models.Model):
    CATEGORY_TYPES = [
        (0, "income"),
        (1, "expense"),
    ]

    category = models.CharField(max_length=100)
    category_type = models.IntegerField(choices=CATEGORY_TYPES)

    def __str__(self):
        return f"{self.category} ({self.get_category_type_display()})"


class Transaction(models.Model):
    TRANSACTION_TYPES = [
        ("income", "Income"),
        ("expense", "Expense"),
        ("transfer", "Transfer"),
        ("buy", "Security purchase"),
        ("sell", "Security sale"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    transaction_type = models.CharField(
        max_length=10, choices=TRANSACTION_TYPES
    )
    date = models.DateField()
    description = models.CharField(max_length=200, null=True, blank=True)
    tags = models.ManyToManyField(Tag, blank=True)
    created_on = models.DateTimeField(auto_now_add=True)
    pinned = models.BooleanField(default=False)
    is_draft = models.BooleanField(default=False)
    draft_created = models.DateTimeField(null=True, blank=True)
    scheduled_apply_at = models.DateTimeField(null=True, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)

    # Legacy flat fields kept for backward compatibility during staged migration.
    amount = models.DecimalField(
        max_digits=19, decimal_places=4, null=True, blank=True
    )
    category = models.ForeignKey(
        TransactionCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="legacy_transactions",
    )
    from_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="legacy_outgoing_transactions",
    )
    to_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="legacy_incoming_transactions",
    )

    class Meta:
        indexes = [
            models.Index(fields=["user", "date"], name="txn_user_date_idx"),
            models.Index(
                fields=["user", "transaction_type", "date"],
                name="txn_user_type_date_idx",
            ),
            models.Index(
                fields=["user", "is_draft", "date"],
                name="txn_user_draft_date_idx",
            ),
        ]

    def __str__(self):
        return f"{self.get_transaction_type_display()} - {self.date}"


class IncomeDetail(models.Model):
    transaction = models.OneToOneField(
        Transaction,
        on_delete=models.CASCADE,
        related_name="income_detail",
    )
    to_cash_balance = models.ForeignKey(
        CashBalance,
        on_delete=models.PROTECT,
        related_name="income_transactions",
    )
    amount = models.DecimalField(max_digits=19, decimal_places=4)
    category = models.ForeignKey(
        TransactionCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=Q(amount__gt=0),
                name="income_detail_amount_gt_zero",
            ),
        ]

    def clean(self):
        if self.category and self.category.category_type != 0:
            raise ValidationError(
                {"category": "Income detail must use an income category."}
            )


class ExpenseDetail(models.Model):
    transaction = models.OneToOneField(
        Transaction,
        on_delete=models.CASCADE,
        related_name="expense_detail",
    )
    from_cash_balance = models.ForeignKey(
        CashBalance,
        on_delete=models.PROTECT,
        related_name="expense_transactions",
    )
    amount = models.DecimalField(max_digits=19, decimal_places=4)
    category = models.ForeignKey(
        TransactionCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=Q(amount__gt=0),
                name="expense_detail_amount_gt_zero",
            ),
        ]

    def clean(self):
        if self.category and self.category.category_type != 1:
            raise ValidationError(
                {"category": "Expense detail must use an expense category."}
            )


class TransferDetail(models.Model):
    transaction = models.OneToOneField(
        Transaction,
        on_delete=models.CASCADE,
        related_name="transfer_detail",
    )
    from_cash_balance = models.ForeignKey(
        CashBalance,
        on_delete=models.PROTECT,
        related_name="transfer_out_transactions",
    )
    to_cash_balance = models.ForeignKey(
        CashBalance,
        on_delete=models.PROTECT,
        related_name="transfer_in_transactions",
    )
    amount = models.DecimalField(max_digits=19, decimal_places=4)
    fx_rate = models.DecimalField(
        max_digits=19,
        decimal_places=8,
        default=Decimal("1"),
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=Q(amount__gt=0),
                name="transfer_detail_amount_gt_zero",
            ),
            models.CheckConstraint(
                check=Q(fx_rate__gt=0),
                name="transfer_detail_fx_rate_gt_zero",
            ),
            models.CheckConstraint(
                check=~Q(from_cash_balance=F("to_cash_balance")),
                name="transfer_detail_from_not_to",
            ),
        ]


class SecurityTradeDetail(models.Model):
    transaction = models.OneToOneField(
        Transaction,
        on_delete=models.CASCADE,
        related_name="security_trade_detail",
    )
    security = models.ForeignKey(
        Security,
        on_delete=models.PROTECT,
        related_name="trades",
    )
    holding = models.ForeignKey(
        Holding,
        on_delete=models.PROTECT,
        related_name="trades",
        null=True,
        blank=True,
    )
    cash_balance = models.ForeignKey(
        CashBalance,
        on_delete=models.PROTECT,
        related_name="security_trades",
    )
    quantity = models.DecimalField(max_digits=19, decimal_places=8)
    price_per_unit = models.DecimalField(max_digits=19, decimal_places=8)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=Q(quantity__gt=0),
                name="security_trade_quantity_gt_zero",
            ),
            models.CheckConstraint(
                check=Q(price_per_unit__gt=0),
                name="security_trade_ppu_gt_zero",
            ),
        ]

    def clean(self):
        if self.transaction.transaction_type not in ("buy", "sell"):
            raise ValidationError(
                {
                    "transaction": (
                        "Security trade detail requires transaction type buy or sell."
                    )
                }
            )

        if self.holding and self.holding.security_id != self.security_id:
            raise ValidationError(
                {"holding": "Holding security must match trade security."}
            )

    @property
    def total_value(self):
        return self.quantity * self.price_per_unit
