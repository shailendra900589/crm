from django.db import migrations


def add_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(
        "CREATE INDEX IF NOT EXISTS lead_custom_data_gin ON api_lead USING gin (custom_data)"
    )


def drop_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("DROP INDEX IF EXISTS lead_custom_data_gin")


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0002_lead_custom_data_leaddocument_verified_by_and_more"),
    ]

    operations = [
        migrations.RunPython(add_gin_index, drop_gin_index),
    ]
