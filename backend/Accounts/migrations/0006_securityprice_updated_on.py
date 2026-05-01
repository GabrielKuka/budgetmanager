from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("Accounts", "0005_account_cash_security_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="securityprice",
            name="updated_on",
            field=models.DateTimeField(
                auto_now=True, default=django.utils.timezone.now
            ),
            preserve_default=False,
        ),
    ]
