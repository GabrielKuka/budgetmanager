# Generated by Django 4.2.1 on 2024-02-13 20:44

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tags", "0001_initial"),
        ("Transactions", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="expense",
            name="tags",
            field=models.ManyToManyField(to="tags.tag"),
        ),
    ]