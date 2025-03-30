from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ("Transactions", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Transaction",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "transaction_type",
                    models.CharField(
                        choices=[
                            ("income", "Income"),
                            ("expense", "Expense"),
                            ("transfer", "Transfer"),
                        ],
                        max_length=10,
                    ),
                ),
                ("amount", models.FloatField(default=0.0)),
                ("date", models.DateField()),
                ("created_on", models.DateTimeField(auto_now_add=True)),
                (
                    "description",
                    models.CharField(blank=True, max_length=100, null=True),
                ),
                (
                    "category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="transactioncategory",
                        to="Transactions.TransactionCategory",
                    ),
                ),
                (
                    "from_account",
                    models.ForeignKey(
                        blank=True,
                        help_text="Source account (for expenses and transfers)",
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="outgoing_transactions",
                        to="Accounts.Account",
                    ),
                ),
                ("tags", models.ManyToManyField(to="tags.Tag")),
                (
                    "to_account",
                    models.ForeignKey(
                        blank=True,
                        help_text="Destination account (for incomes and transfers)",
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="incoming_transactions",
                        to="Accounts.Account",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
