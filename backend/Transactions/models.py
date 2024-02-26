from django.conf import settings
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
