from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("Transactions", "0006_backfill_transaction_detail_tables"),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                "DROP TABLE IF EXISTS Templates_template_tags;",
                "DROP TABLE IF EXISTS Templates_template;",
                "DROP TABLE IF EXISTS Templates_templategroup;",
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql=[
                """
                DELETE FROM auth_permission
                WHERE content_type_id IN (
                    SELECT id
                    FROM django_content_type
                    WHERE app_label='Templates'
                      AND model IN ('template', 'templategroup')
                );
                """,
                """
                UPDATE django_admin_log
                SET content_type_id = NULL
                WHERE content_type_id IN (
                    SELECT id
                    FROM django_content_type
                    WHERE app_label='Templates'
                      AND model IN ('template', 'templategroup')
                );
                """,
                """
                DELETE FROM django_content_type
                WHERE app_label='Templates'
                  AND model IN ('template', 'templategroup');
                """,
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
