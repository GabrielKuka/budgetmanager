from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class SafeCreateModel(migrations.CreateModel):
    def database_backwards(
        self, app_label, schema_editor, from_state, to_state
    ):
        model = from_state.apps.get_model(app_label, self.name)
        if (
            model._meta.db_table
            in schema_editor.connection.introspection.table_names()
        ):
            schema_editor.delete_model(model)


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("Transactions", "0013_trade_detail_tangible_asset"),
    ]

    operations = [
        SafeCreateModel(
            name="SavedSearch",
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
                ("name", models.CharField(max_length=100)),
                ("filters", models.JSONField(default=dict)),
                ("sort", models.CharField(default="date_desc", max_length=32)),
                ("grouping", models.CharField(default="none", max_length=32)),
                ("created_on", models.DateTimeField(auto_now_add=True)),
                ("updated_on", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="saved_transaction_searches",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["name", "id"],
                "unique_together": {("user", "name")},
            },
        ),
        SafeCreateModel(
            name="SearchInsightDismissal",
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
                    "insight_type",
                    models.CharField(
                        choices=[
                            ("duplicate", "Duplicate"),
                            ("recurring", "Recurring"),
                        ],
                        max_length=16,
                    ),
                ),
                ("fingerprint", models.CharField(max_length=64)),
                ("dismissed_on", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="dismissed_transaction_insights",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "unique_together": {("user", "insight_type", "fingerprint")}
            },
        ),
    ]
