from django.db import migrations, models
from django.db.models import Q
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("Transactions", "0012_remove_transaction_scheduled_apply_at"),
        ("tangible_assets", "0001_initial"),
    ]
    operations = [
        migrations.AlterField(
            model_name="securitytradedetail",
            name="transaction",
            field=models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="trade_detail", to="Transactions.transaction"),
        ),
        migrations.AlterField(
            model_name="securitytradedetail",
            name="security",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="trades", to="Accounts.security"),
        ),
        migrations.AddField(
            model_name="securitytradedetail",
            name="tangible_asset",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="trades", to="tangible_assets.tangibleasset"),
        ),
        migrations.AddConstraint(
            model_name="securitytradedetail",
            constraint=models.CheckConstraint(check=(Q(security__isnull=False, tangible_asset__isnull=True) | Q(security__isnull=True, tangible_asset__isnull=False)), name="trade_detail_exactly_one_asset_target"),
        ),
    ]
