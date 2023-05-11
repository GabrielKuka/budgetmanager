# Generated by Django 4.0.2 on 2023-04-07 22:00

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "Templates",
            "0004_alter_template_account_alter_template_category_and_more",
        ),
    ]

    operations = [
        migrations.AlterField(
            model_name="template",
            name="account",
            field=models.SmallIntegerField(blank=True, default=-1, null=True),
        ),
        migrations.AlterField(
            model_name="template",
            name="category",
            field=models.SmallIntegerField(blank=True, default=-1, null=True),
        ),
        migrations.AlterField(
            model_name="template",
            name="from_account",
            field=models.SmallIntegerField(blank=True, default=-1, null=True),
        ),
        migrations.AlterField(
            model_name="template",
            name="to_account",
            field=models.SmallIntegerField(blank=True, default=-1, null=True),
        ),
    ]