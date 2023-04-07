from django.db import models
from django.conf import settings


class Template(models.Model):

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )

    transaction_types = [
        (0, "Income"),
        (1, "Expense"),
        (2, "Transfer"),
    ]

    date = models.DateField()
    type = models.IntegerField(
        choices=transaction_types, default=transaction_types[0]
    )
    created_on = models.DateTimeField(auto_now_add=True)
    amount = models.FloatField(default=0.0)
    description = models.CharField(max_length=100, null=True, blank=True)

    from_account = models.CharField(max_length=100, null=True, blank=True)
    to_account = models.CharField(max_length=100, null=True, blank=True)
    account = models.CharField(max_length=100, null=True, blank=True)
    category = models.CharField(max_length=100, null=True, blank=True)
