from decimal import Decimal

from django.db import migrations


def noop_reverse(apps, schema_editor):
    pass


def ensure_schema_compatibility(apps, schema_editor):
    """
    Compatibility guard:
    if an environment applied an older local 0005 draft, ensure the DB still has
    the legacy Transaction columns and detail tables expected by this branch.
    """
    connection = schema_editor.connection
    Transaction = apps.get_model("Transactions", "Transaction")
    IncomeDetail = apps.get_model("Transactions", "IncomeDetail")
    ExpenseDetail = apps.get_model("Transactions", "ExpenseDetail")
    TransferDetail = apps.get_model("Transactions", "TransferDetail")

    table_names = set(connection.introspection.table_names())
    transaction_table = Transaction._meta.db_table

    with connection.cursor() as cursor:
        tx_columns = {
            column.name
            for column in connection.introspection.get_table_description(
                cursor, transaction_table
            )
        }

    required_columns = {
        "amount": "amount",
        "category": "category_id",
        "from_account": "from_account_id",
        "to_account": "to_account_id",
    }

    for field_name, column_name in required_columns.items():
        if column_name in tx_columns:
            continue
        field = Transaction._meta.get_field(field_name)
        schema_editor.add_field(Transaction, field)
        tx_columns.add(column_name)

    for model in (IncomeDetail, ExpenseDetail, TransferDetail):
        if model._meta.db_table in table_names:
            continue
        schema_editor.create_model(model)
        table_names.add(model._meta.db_table)


def _get_account_currency(account, Currency, fallback_currency):
    currency_code = getattr(account, "currency", None) or "EUR"
    currency = Currency.objects.filter(code=currency_code).first()
    if currency:
        return currency
    return fallback_currency


def _get_or_create_balance(CashBalance, account, currency):
    cash_balance, _ = CashBalance.objects.get_or_create(
        account_id=account.id,
        currency_id=currency.id,
        defaults={"balance": Decimal("0")},
    )
    return cash_balance


def backfill_detail_tables(apps, schema_editor):
    Transaction = apps.get_model("Transactions", "Transaction")
    IncomeDetail = apps.get_model("Transactions", "IncomeDetail")
    ExpenseDetail = apps.get_model("Transactions", "ExpenseDetail")
    TransferDetail = apps.get_model("Transactions", "TransferDetail")
    Account = apps.get_model("Accounts", "Account")
    CashBalance = apps.get_model("Accounts", "CashBalance")
    Currency = apps.get_model("Accounts", "Currency")

    fallback_currency = (
        Currency.objects.filter(code="EUR").first() or Currency.objects.first()
    )
    if not fallback_currency:
        return

    for txn in Transaction.objects.all().iterator():
        amount = txn.amount
        if amount in (None, ""):
            continue

        amount = Decimal(str(amount))
        if amount <= 0:
            continue

        if txn.transaction_type == "income":
            if IncomeDetail.objects.filter(transaction_id=txn.id).exists():
                continue
            if not txn.to_account_id:
                continue
            account = Account.objects.filter(pk=txn.to_account_id).first()
            if not account:
                continue
            currency = _get_account_currency(
                account, Currency, fallback_currency
            )
            cash_balance = _get_or_create_balance(
                CashBalance, account, currency
            )
            category_id = None
            if txn.category_id:
                category = txn.category
                if category and category.category_type == 0:
                    category_id = category.id
            IncomeDetail.objects.create(
                transaction_id=txn.id,
                to_cash_balance_id=cash_balance.id,
                amount=amount,
                category_id=category_id,
            )
            continue

        if txn.transaction_type == "expense":
            if ExpenseDetail.objects.filter(transaction_id=txn.id).exists():
                continue
            if not txn.from_account_id:
                continue
            account = Account.objects.filter(pk=txn.from_account_id).first()
            if not account:
                continue
            currency = _get_account_currency(
                account, Currency, fallback_currency
            )
            cash_balance = _get_or_create_balance(
                CashBalance, account, currency
            )
            category_id = None
            if txn.category_id:
                category = txn.category
                if category and category.category_type == 1:
                    category_id = category.id
            ExpenseDetail.objects.create(
                transaction_id=txn.id,
                from_cash_balance_id=cash_balance.id,
                amount=amount,
                category_id=category_id,
            )
            continue

        if txn.transaction_type == "transfer":
            if TransferDetail.objects.filter(transaction_id=txn.id).exists():
                continue
            if not txn.from_account_id or not txn.to_account_id:
                continue
            from_account = Account.objects.filter(
                pk=txn.from_account_id
            ).first()
            to_account = Account.objects.filter(pk=txn.to_account_id).first()
            if not from_account or not to_account:
                continue

            from_currency = _get_account_currency(
                from_account, Currency, fallback_currency
            )
            to_currency = _get_account_currency(
                to_account, Currency, fallback_currency
            )
            from_balance = _get_or_create_balance(
                CashBalance, from_account, from_currency
            )
            to_balance = _get_or_create_balance(
                CashBalance, to_account, to_currency
            )

            if from_balance.id == to_balance.id:
                continue

            TransferDetail.objects.create(
                transaction_id=txn.id,
                from_cash_balance_id=from_balance.id,
                to_cash_balance_id=to_balance.id,
                amount=amount,
                fx_rate=Decimal("1"),
            )


class Migration(migrations.Migration):
    dependencies = [
        ("Transactions", "0005_transaction_cash_balance_and_buy_sell"),
    ]

    operations = [
        migrations.RunPython(ensure_schema_compatibility, noop_reverse),
        migrations.RunPython(backfill_detail_tables, noop_reverse),
    ]
