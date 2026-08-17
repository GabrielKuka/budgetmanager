from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models
import django.db.models.deletion


def seed_units(apps, schema_editor):
    Unit = apps.get_model("tangible_assets", "Unit")
    for code, name, symbol, dimension in (
        ("piece", "Piece", "pc", "count"),
        ("gram", "Gram", "g", "mass"),
        ("kilogram", "Kilogram", "kg", "mass"),
        ("square_meter", "Square metre", "m²", "area"),
    ):
        Unit.objects.get_or_create(
            code=code,
            defaults={"name": name, "symbol": symbol, "dimension": dimension},
        )


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("Accounts", "0006_securityprice_updated_on"),
    ]
    operations = [
        migrations.CreateModel(
            name="Unit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=32, unique=True)),
                ("name", models.CharField(max_length=100)),
                ("symbol", models.CharField(blank=True, max_length=16)),
                ("dimension", models.CharField(choices=[("count", "Count"), ("mass", "Mass"), ("area", "Area"), ("other", "Other")], default="count", max_length=16)),
                ("factor_to_base", models.DecimalField(decimal_places=8, default=1, max_digits=19)),
                ("is_active", models.BooleanField(default=True)),
                ("created_on", models.DateTimeField(auto_now_add=True)),
                ("updated_on", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="TangibleAsset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("asset_type", models.CharField(choices=[("real_estate", "Owned Real Estate"), ("vehicle", "Vehicle"), ("precious_metal", "Precious Metal"), ("art", "Art"), ("collectible", "Collectible"), ("other", "Other Tangible Asset")], max_length=32)),
                ("acquired_on", models.DateField()),
                ("acquisition_cost", models.DecimalField(decimal_places=2, max_digits=19, validators=[MinValueValidator(0)])),
                ("notes", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("active", "Active"), ("sold", "Sold"), ("disposed", "Disposed")], default="active", max_length=16)),
                ("disposed_on", models.DateField(blank=True, null=True)),
                ("disposal_reason", models.TextField(blank=True)),
                ("property_type", models.CharField(blank=True, choices=[("residential", "Residential"), ("commercial", "Commercial"), ("land", "Land"), ("other", "Other")], max_length=32, null=True)),
                ("address", models.TextField(blank=True)),
                ("quantity", models.DecimalField(decimal_places=8, default=1, max_digits=19, validators=[MinValueValidator(0.00000001)])),
                ("purity", models.DecimalField(blank=True, decimal_places=4, max_digits=6, null=True, validators=[MinValueValidator(0), MaxValueValidator(1)])),
                ("created_on", models.DateTimeField(auto_now_add=True)),
                ("updated_on", models.DateTimeField(auto_now=True)),
                ("currency", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="tangible_assets", to="Accounts.currency")),
                ("unit", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="assets", to="tangible_assets.unit")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tangible_assets", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-acquired_on", "-id"]},
        ),
        migrations.CreateModel(
            name="TangibleAssetValuation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField()),
                ("value", models.DecimalField(decimal_places=2, max_digits=19, validators=[MinValueValidator(0.0001)])),
                ("notes", models.TextField(blank=True)),
                ("source", models.CharField(choices=[("acquisition", "Acquisition"), ("manual", "Manual")], default="manual", max_length=16)),
                ("created_on", models.DateTimeField(auto_now_add=True)),
                ("updated_on", models.DateTimeField(auto_now=True)),
                ("asset", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="valuations", to="tangible_assets.tangibleasset")),
            ],
            options={"ordering": ["-date", "-id"]},
        ),
        migrations.AddConstraint(
            model_name="tangibleassetvaluation",
            constraint=models.UniqueConstraint(fields=("asset", "date"), name="tangible_asset_valuation_day"),
        ),
        migrations.RunPython(seed_units, migrations.RunPython.noop),
    ]
