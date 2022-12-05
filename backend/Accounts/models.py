from django.db import models
from django.conf import settings


class Account(models.Model):

    account_types = [(0, "Bank Account"), (1, "Investment Account"), (2, 'Hard Cash')]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    type = models.IntegerField(choices=account_types, default=account_types[0])
    name = models.CharField(max_length=100, default="")
    amount = models.FloatField(default=0.0)
    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)
