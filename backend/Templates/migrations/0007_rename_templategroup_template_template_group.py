# Generated by Django 4.0.2 on 2023-04-09 20:54

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("Templates", "0006_templategroup_template_templategroup"),
    ]

    operations = [
        migrations.RenameField(
            model_name="template",
            old_name="templateGroup",
            new_name="template_group",
        ),
    ]
