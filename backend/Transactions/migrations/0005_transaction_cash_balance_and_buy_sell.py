from decimal import Decimal

from django.db import migrations, models
from django.db.models import F, Q
import django.db.models.deletion


class Migration(migrations.Migration):
    """
    Stage 1:
    - Align Transaction to support buy/sell and keep legacy columns.
    - Create detail tables used by the new architecture.
    """

    dependencies = [
        ("Accounts", "0005_account_cash_security_models"),
        ("Transactions", "0004_auto_20250330_1507"),
    ]

    operations = [
        migrations.AlterField(
            model_name="transaction",
            name="amount",
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                max_digits=19,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="transaction",
            name="category",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="legacy_transactions",
                to="Transactions.transactioncategory",
            ),
        ),
        migrations.AlterField(
            model_name="transaction",
            name="description",
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
        migrations.AlterField(
            model_name="transaction",
            name="from_account",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="legacy_outgoing_transactions",
                to="Accounts.account",
            ),
        ),
        migrations.AlterField(
            model_name="transaction",
            name="to_account",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="legacy_incoming_transactions",
                to="Accounts.account",
            ),
        ),
        migrations.AlterField(
            model_name="transaction",
            name="transaction_type",
            field=models.CharField(
                choices=[
                    ("income", "Income"),
                    ("expense", "Expense"),
                    ("transfer", "Transfer"),
                    ("buy", "Security purchase"),
                    ("sell", "Security sale"),
                ],
                max_length=10,
            ),
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(fields=["user", "date"], name="txn_user_date_idx"),
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(
                fields=["user", "transaction_type", "date"],
                name="txn_user_type_date_idx",
            ),
        ),
        migrations.CreateModel(
            name="IncomeDetail",
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
                ("amount", models.DecimalField(decimal_places=4, max_digits=19)),
                (
                    "category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="Transactions.transactioncategory",
                    ),
                ),
                (
                    "to_cash_balance",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="income_transactions",
                        to="Accounts.cashbalance",
                    ),
                ),
                (
                    "transaction",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="income_detail",
                        to="Transactions.transaction",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.CheckConstraint(
                        check=Q(amount__gt=0),
                        name="income_detail_amount_gt_zero",
                    )
                ]
            },
        ),
        migrations.CreateModel(
            name="ExpenseDetail",
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
                ("amount", models.DecimalField(decimal_places=4, max_digits=19)),
                (
                    "category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="Transactions.transactioncategory",
                    ),
                ),
                (
                    "from_cash_balance",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="expense_transactions",
                        to="Accounts.cashbalance",
                    ),
                ),
                (
                    "transaction",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="expense_detail",
                        to="Transactions.transaction",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.CheckConstraint(
                        check=Q(amount__gt=0),
                        name="expense_detail_amount_gt_zero",
                    )
                ]
            },
        ),
        migrations.CreateModel(
            name="TransferDetail",
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
                ("amount", models.DecimalField(decimal_places=4, max_digits=19)),
                (
                    "fx_rate",
                    models.DecimalField(
                        decimal_places=8,
                        default=Decimal("1"),
                        max_digits=19,
                    ),
                ),
                (
                    "from_cash_balance",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="transfer_out_transactions",
                        to="Accounts.cashbalance",
                    ),
                ),
                (
                    "to_cash_balance",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="transfer_in_transactions",
                        to="Accounts.cashbalance",
                    ),
                ),
                (
                    "transaction",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="transfer_detail",
                        to="Transactions.transaction",
                    ),
                ),
            ],
            options={
                "constraints": [
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
            },
        ),
        migrations.CreateModel(
            name="SecurityTradeDetail",
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
                ("quantity", models.DecimalField(decimal_places=8, max_digits=19)),
                (
                    "price_per_unit",
                    models.DecimalField(decimal_places=8, max_digits=19),
                ),
                (
                    "cash_balance",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="security_trades",
                        to="Accounts.cashbalance",
                    ),
                ),
                (
                    "holding",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="trades",
                        to="Accounts.holding",
                    ),
                ),
                (
                    "security",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="trades",
                        to="Accounts.security",
                    ),
                ),
                (
                    "transaction",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="security_trade_detail",
                        to="Transactions.transaction",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.CheckConstraint(
                        check=Q(quantity__gt=0),
                        name="security_trade_quantity_gt_zero",
                    ),
                    models.CheckConstraint(
                        check=Q(price_per_unit__gt=0),
                        name="security_trade_ppu_gt_zero",
                    ),
                ]
            },
        ),
    ]
