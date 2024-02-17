from django.conf import settings
from django.db import models

from tags.models import Tag


class TemplateGroup(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )

    created_on = models.DateTimeField(auto_now_add=True)
    name = models.CharField(max_length=100)


class Template(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    tags = models.ManyToManyField(Tag)

    transaction_types = [
        (0, "Income"),
        (1, "Expense"),
        (2, "Transfer"),
    ]

    template_group = models.ForeignKey(
        TemplateGroup,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="template_group",
    )
    type = models.SmallIntegerField(
        choices=transaction_types, default=transaction_types[0]
    )
    created_on = models.DateTimeField(auto_now_add=True)
    amount = models.FloatField(default=0.0)
    description = models.CharField(max_length=100, null=True, blank=True)

    from_account = models.SmallIntegerField(default=-1, null=True, blank=True)
    to_account = models.SmallIntegerField(default=-1, null=True, blank=True)
    account = models.SmallIntegerField(default=-1, null=True, blank=True)
    category = models.SmallIntegerField(default=-1, null=True, blank=True)
