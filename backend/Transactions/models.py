from django.db import models
from django.conf import settings

from Accounts.models import Account


class ExpenseCategory(models.Model):
    category_type = models.CharField(max_length=100, default="")


class IncomeCategory(models.Model):
    category_type = models.CharField(max_length=100, default="")


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
    date = models.DateField()
    created_on = models.DateTimeField(auto_now_add=True)
    amount = models.FloatField(default=0.0)
    expense_category = models.ForeignKey(
        ExpenseCategory,
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
    created_on = models.DateTimeField(auto_now_add=True)
    amount = models.FloatField(default=0.0)
    description = models.CharField(max_length=100, null=True, blank=True)
    income_category = models.ForeignKey(
        IncomeCategory,
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
