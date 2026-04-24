from django.db import migrations


def delete_smoke_categories(apps, schema_editor):
    transaction_category = apps.get_model(
        "Transactions", "TransactionCategory"
    )
    transaction_category.objects.filter(
        category="Smoke Salary",
        category_type=0,
    ).delete()
    transaction_category.objects.filter(
        category="Smoke Food",
        category_type=1,
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("Transactions", "0007_remove_templates_feature_tables"),
    ]

    operations = [
        migrations.RunPython(
            delete_smoke_categories,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
