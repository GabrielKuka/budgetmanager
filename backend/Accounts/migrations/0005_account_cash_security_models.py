from django.core.validators import RegexValidator
from django.db import migrations, models
import django.db.models.deletion


def seed_currencies_and_cash_balances(apps, schema_editor):
    Account = apps.get_model("Accounts", "Account")
    CashBalance = apps.get_model("Accounts", "CashBalance")
    Currency = apps.get_model("Accounts", "Currency")

    defaults = {
        "EUR": ("Euro", "EUR", "fiat"),
        "USD": ("US Dollar", "USD", "fiat"),
        "GBP": ("British Pound", "GBP", "fiat"),
        "BGN": ("Bulgarian Lev", "BGN", "fiat"),
        "ALL": ("Albanian Lek", "ALL", "fiat"),
        "CHF": ("Swiss Franc", "CHF", "fiat"),
    }
    for code, (name, symbol, currency_type) in defaults.items():
        Currency.objects.get_or_create(
            code=code,
            defaults={
                "name": name,
                "symbol": symbol,
                "currency_type": currency_type,
                "exchange_rate_regime": "floating",
                "is_active": True,
            },
        )

    fallback_currency = Currency.objects.get(code="EUR")
    for account in Account.objects.all():
        currency_code = getattr(account, "currency", None) or "EUR"
        currency = (
            Currency.objects.filter(code=currency_code).first() or fallback_currency
        )
        amount = getattr(account, "amount", 0) or 0
        CashBalance.objects.get_or_create(
            account=account,
            currency=currency,
            defaults={"balance": amount},
        )


class Migration(migrations.Migration):
    dependencies = [
        ("Accounts", "0004_account_deleted"),
    ]

    operations = [
        migrations.CreateModel(
            name="Currency",
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
                ("code", models.CharField(max_length=10, unique=True)),
                ("name", models.CharField(max_length=100)),
                ("symbol", models.CharField(max_length=10)),
                (
                    "currency_type",
                    models.CharField(
                        choices=[("fiat", "Fiat"), ("crypto", "Cryptocurrency")],
                        default="fiat",
                        max_length=10,
                    ),
                ),
                (
                    "exchange_rate_regime",
                    models.CharField(
                        blank=True,
                        choices=[("floating", "Floating"), ("pegged", "Pegged")],
                        max_length=10,
                        null=True,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("created_on", models.DateTimeField(auto_now_add=True)),
                ("updated_on", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="Security",
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
                    "isin",
                    models.CharField(
                        blank=True,
                        max_length=12,
                        null=True,
                        unique=True,
                        validators=[
                            RegexValidator(
                                message="ISIN must be 12 characters: 2 letters + 9 alphanumeric + 1 digit (e.g. US0378331005)",
                                regex="^[A-Z]{2}[A-Z0-9]{9}[0-9]$",
                            )
                        ],
                    ),
                ),
                (
                    "structure",
                    models.CharField(
                        choices=[
                            ("stock", "Stock"),
                            ("etf", "ETF"),
                            ("mutual_fund", "Mutual Fund"),
                            ("bond", "Bond"),
                            ("other", "Other"),
                        ],
                        default="stock",
                        max_length=20,
                    ),
                ),
                (
                    "asset_class",
                    models.CharField(
                        choices=[
                            ("equity", "Equity"),
                            ("fixed_income", "Fixed Income"),
                            ("money_market", "Money Market"),
                            ("commodity", "Commodity"),
                            ("real_estate", "Real Estate"),
                            ("mixed", "Mixed"),
                            ("other", "Other"),
                        ],
                        default="equity",
                        max_length=20,
                    ),
                ),
                ("name", models.CharField(max_length=100)),
                ("ticker", models.CharField(max_length=10, unique=True)),
                (
                    "description",
                    models.CharField(blank=True, max_length=100, null=True),
                ),
                ("created_on", models.DateTimeField(auto_now_add=True)),
                ("updated_on", models.DateTimeField(auto_now=True)),
                (
                    "currency",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="securities",
                        to="Accounts.currency",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="CashBalance",
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
                    "balance",
                    models.DecimalField(decimal_places=8, default=0, max_digits=19),
                ),
                ("created_on", models.DateTimeField(auto_now_add=True)),
                ("updated_on", models.DateTimeField(auto_now=True)),
                (
                    "account",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cash_balances",
                        to="Accounts.account",
                    ),
                ),
                (
                    "currency",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="cash_balances",
                        to="Accounts.currency",
                    ),
                ),
            ],
            options={
                "unique_together": {("account", "currency")},
            },
        ),
        migrations.CreateModel(
            name="Holding",
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
                    "quantity",
                    models.DecimalField(decimal_places=8, default=0, max_digits=19),
                ),
                (
                    "average_cost",
                    models.DecimalField(decimal_places=8, default=0, max_digits=19),
                ),
                ("created_on", models.DateTimeField(auto_now_add=True)),
                ("updated_on", models.DateTimeField(auto_now=True)),
                (
                    "account",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="holdings",
                        to="Accounts.account",
                    ),
                ),
                (
                    "security",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="holdings",
                        to="Accounts.security",
                    ),
                ),
            ],
            options={
                "unique_together": {("account", "security")},
            },
        ),
        migrations.CreateModel(
            name="SecurityPrice",
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
                ("date", models.DateField()),
                ("price", models.DecimalField(decimal_places=8, max_digits=19)),
                ("source", models.CharField(default="manual", max_length=100)),
                ("created_on", models.DateTimeField(auto_now_add=True)),
                (
                    "security",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="prices",
                        to="Accounts.security",
                    ),
                ),
            ],
            options={
                "ordering": ["-date", "-created_on"],
                "unique_together": {("security", "date", "source")},
            },
        ),
        migrations.RunPython(
            seed_currencies_and_cash_balances, migrations.RunPython.noop
        ),
        migrations.AlterField(
            model_name="account",
            name="type",
            field=models.IntegerField(
                choices=[
                    (0, "Bank Account"),
                    (1, "Investment Account"),
                    (2, "Hard Cash"),
                ],
                default=0,
            ),
        ),
    ]
