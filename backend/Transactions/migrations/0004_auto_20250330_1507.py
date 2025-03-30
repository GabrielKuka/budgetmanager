from django.db import migrations, transaction as tr


def migrate_data_to_transaction(apps, schema_editor):
    Transaction = apps.get_model("Transactions", "Transaction")
    Income = apps.get_model("Transactions", "Income")
    Expense = apps.get_model("Transactions", "Expense")
    Transfer = apps.get_model("Transactions", "Transfer")

    try:
        with tr.atomic():
            # Migrate Income data
            for income in Income.objects.all():
                transaction = Transaction.objects.create(
                    user=income.user,
                    transaction_type="income",
                    amount=income.amount,
                    date=income.date,
                    created_on=income.created_on,
                    description=income.description,
                    to_account=income.account,
                    category=income.income_category,
                )
                transaction.tags.set(income.tags.all())

            # Migrate Expense data
            for expense in Expense.objects.all():
                transaction = Transaction.objects.create(
                    user=expense.user,
                    transaction_type="expense",
                    amount=expense.amount,
                    date=expense.date,
                    created_on=expense.created_on,
                    description=expense.description,
                    from_account=expense.account,
                    category=expense.expense_category,
                )
                transaction.tags.set(expense.tags.all())

            # Migrate Transfer data
            for transfer in Transfer.objects.all():
                transaction = Transaction.objects.create(
                    user=transfer.user,
                    transaction_type="transfer",
                    amount=transfer.amount,
                    date=transfer.date,
                    created_on=transfer.created_on,
                    description=transfer.description,
                    from_account=transfer.from_account,
                    to_account=transfer.to_account,
                )
                transaction.tags.set(transfer.tags.all())

    except Exception as e:
        print(e)


class Migration(migrations.Migration):

    dependencies = [
        ("Transactions", "0003_auto_20250330_1457"),
    ]

    operations = [
        migrations.RunPython(migrate_data_to_transaction),
    ]
