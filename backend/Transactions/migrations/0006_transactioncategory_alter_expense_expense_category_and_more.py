# Generated by Django 4.2.1 on 2024-02-26 18:41

from django.db import migrations, models
import django.db.models.deletion


def up(self, schema_editor):
    from Transactions.models import TransactionCategory, Income, Expense

    # Loop through all income records
    for income in Income.objects.all():
        old_category_id = income.income_category_id

        # Check if the category exists in the new table
        if TransactionCategory.objects.filter(pk=old_category_id).exists():
            new_category = TransactionCategory.objects.get(pk=old_category_id)
            income.income_category = new_category
            income.save()
        else:
            # Handle cases where the category doesn't exist
            # (log, ignore, etc. based on your needs)
            print(
                f"income record with id {income.id} references non-existent category id {old_category_id}"
            )

    # Loop through all income records
    for expense in Expense.objects.all():
        old_category_id = (
            expense.expense_category_id
        )  # Use the original ID directly

        # Check if the category exists in the new table (with or without offset)
        if TransactionCategory.objects.filter(pk=old_category_id).exists():
            new_category = TransactionCategory.objects.get(pk=old_category_id)
        elif TransactionCategory.objects.filter(
            pk=old_category_id + 10
        ).exists():
            new_category = TransactionCategory.objects.get(
                pk=old_category_id + 10
            )
        else:
            print(
                f"Expense record with id {expense.id} references non-existent category id {old_category_id}"
            )  # Error message with the original ID
            continue  # Skip this expense to avoid further errors

        expense.expense_category = new_category
        expense.save()


class Migration(migrations.Migration):
    dependencies = [
        (
            "Transactions",
            "0005_transactioncategory_alter_expense_expense_category_and_more",
        ),
    ]

    operations = [migrations.RunPython(up)]
