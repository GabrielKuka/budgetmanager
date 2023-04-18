# Generated by Django 4.0.2 on 2023-04-07 21:24

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("Templates", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="template",
            name="account",
            field=models.SmallIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="template",
            name="category",
            field=models.SmallIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="template",
            name="from_account",
            field=models.SmallIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="template",
            name="to_account",
            field=models.SmallIntegerField(blank=True, null=True),
        ),
    ]
