from django.conf import settings
from rest_framework.exceptions import ValidationError
from django.db import models

from Accounts.models import Account
from tags.models import Tag


class TransactionCategory(models.Model):

    valid_types = [(0, "income"), (1, "expense")]

    category = models.CharField(max_length=100, default="")
    category_type = models.IntegerField(
        choices=valid_types, default=valid_types[1]
    )


class Expense(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    account = models.ForeignKey(
        Account,
        related_name="expense_account",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    tags = models.ManyToManyField(Tag)
    date = models.DateField()
    created_on = models.DateTimeField(auto_now_add=True)
    amount = models.FloatField(default=0.0)
    expense_category = models.ForeignKey(
        TransactionCategory,
        related_name="expense_category",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    description = models.CharField(max_length=100, null=True, blank=True)


class Income(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    account = models.ForeignKey(
        Account,
        related_name="income_account",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    date = models.DateField()
    tags = models.ManyToManyField(Tag)
    created_on = models.DateTimeField(auto_now_add=True)
    amount = models.FloatField(default=0.0)
    description = models.CharField(max_length=100, null=True, blank=True)
    income_category = models.ForeignKey(
        TransactionCategory,
        related_name="income_category",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )


class Transfer(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    to_account = models.ForeignKey(
        Account,
        related_name="to_account",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    tags = models.ManyToManyField(Tag)
    from_account = models.ForeignKey(
        Account,
        related_name="from_account",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    date = models.DateField()
    created_on = models.DateTimeField(auto_now_add=True)
    amount = models.FloatField(default=0.0)
    description = models.CharField(max_length=100, null=True, blank=True)


class Transaction(models.Model):
    TRANSACTION_TYPES = [
        ("income", "Income"),
        ("expense", "Expense"),
        ("transfer", "Transfer"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    transaction_type = models.CharField(
        max_length=10, choices=TRANSACTION_TYPES
    )

    # Common fields
    amount = models.FloatField(default=0.0)
    date = models.DateField()
    created_on = models.DateTimeField(auto_now_add=True)
    description = models.CharField(max_length=100, null=True, blank=True)
    tags = models.ManyToManyField(Tag)

    # Account references
    from_account = models.ForeignKey(
        Account,
        related_name="outgoing_account",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Source account (for expenses and transfers)",
    )
    to_account = models.ForeignKey(
        Account,
        related_name="incoming_account",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Destination account (for incomes and transfers)",
    )

    # Category reference - only applicable for income and expense
    category = models.ForeignKey(
        TransactionCategory,
        related_name="transactioncategory",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )

    def clean(self):
        # Validation logic
        if self.transaction_type == "income" and not self.to_account:
            raise ValidationError(
                "Income transactions require a destination account"
            )

        if self.transaction_type == "expense" and not self.from_account:
            raise ValidationError(
                "Expense transactions require a source account"
            )

        if self.transaction_type == "transfer":
            if not self.from_account:
                raise ValidationError(
                    "Transfer transactions require a source account"
                )
            if not self.to_account:
                raise ValidationError(
                    "Transfer transactions require a destination account"
                )

        # Ensure appropriate NULL values based on transaction type
        if self.transaction_type == "income" and self.from_account:
            self.from_account = None

        if self.transaction_type == "expense" and self.to_account:
            self.to_account = None

        # Category validation
        if (
            self.transaction_type == "income"
            and self.category
            and self.category.category_type != 0
        ):
            raise ValidationError(
                "Income transactions require income category type"
            )

        if (
            self.transaction_type == "expense"
            and self.category
            and self.category.category_type != 1
        ):
            raise ValidationError(
                "Expense transactions require expense category type"
            )

    @property
    def is_income(self):
        return self.transaction_type == "income"

    @property
    def is_expense(self):
        return self.transaction_type == "expense"

    @property
    def is_transfer(self):
        return self.transaction_type == "transfer"
