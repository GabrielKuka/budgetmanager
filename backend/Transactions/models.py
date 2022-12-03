from django.db import models
from django.conf import settings

from Accounts.models import DimAccount


class DimExpenseCategory(models.Model):
    category_type = models.CharField(max_length=100, default="")


class DimIncomeCategory(models.Model):
    category_type = models.CharField(max_length=100, default="")


class FactTransaction(models.Model):

    transaction_types = [(0, "Income"), (1, "Expense"), (2, "Transfer")]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    account = models.ForeignKey(
        DimAccount,
        related_name="account",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    to_account = models.ForeignKey(
        DimAccount,
        related_name="to_account",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    from_account = models.ForeignKey(
        DimAccount,
        related_name="from_account",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    date = models.DateField()
    created_on = models.DateTimeField(auto_now_add=True)
    amount = models.FloatField(default=0.0)
    type = models.IntegerField(choices=transaction_types)
    expense_category = models.ForeignKey(
        DimExpenseCategory,
        related_name="expense_category",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    income_category = models.ForeignKey(
        DimIncomeCategory,
        related_name="income_category",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    transfer_reason = models.CharField(max_length=200, null=True, blank=True)
