from django.db import migrations, models


def seed_troy_ounce(apps, schema_editor):
    Unit = apps.get_model("tangible_assets", "Unit")
    Unit.objects.get_or_create(
        code="troy_ounce",
        defaults={
            "name": "Troy ounce",
            "symbol": "t oz",
            "dimension": "mass",
        },
    )


class Migration(migrations.Migration):
    dependencies = [("tangible_assets", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="tangibleasset",
            name="metal_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("gold", "Gold"),
                    ("silver", "Silver"),
                    ("platinum", "Platinum"),
                    ("palladium", "Palladium"),
                    ("other", "Other"),
                ],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="tangibleasset",
            name="metal_name",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.RunPython(seed_troy_ounce, migrations.RunPython.noop),
    ]
