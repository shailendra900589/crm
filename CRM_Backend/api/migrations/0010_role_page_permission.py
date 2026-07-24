from django.db import migrations, models


def seed_page_permissions(apps, schema_editor):
    RolePagePermission = apps.get_model("api", "RolePagePermission")
    defaults = {
        "Manager": {
            "dashboard": True,
            "leads": True,
            "pipeline": True,
            "duplicates": True,
            "follow-ups": True,
            "alerts": True,
            "reports": True,
            "targets": True,
            "visits": True,
            "team": True,
            "profile": True,
        },
        "TL": {
            "dashboard": True,
            "leads": True,
            "pipeline": True,
            "duplicates": True,
            "follow-ups": True,
            "alerts": True,
            "reports": True,
            "targets": True,
            "visits": True,
            "team": True,
            "profile": True,
        },
        "BDM": {
            "dashboard": True,
            "leads": True,
            "pipeline": True,
            "duplicates": False,
            "follow-ups": True,
            "alerts": True,
            "reports": True,
            "targets": True,
            "visits": True,
            "team": False,
            "profile": True,
        },
    }
    for role, pages in defaults.items():
        for page_key, enabled in pages.items():
            RolePagePermission.objects.get_or_create(
                role=role,
                page_key=page_key,
                defaults={"enabled": enabled},
            )


def unseed_page_permissions(apps, schema_editor):
    RolePagePermission = apps.get_model("api", "RolePagePermission")
    RolePagePermission.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0009_sales_target"),
    ]

    operations = [
        migrations.CreateModel(
            name="RolePagePermission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("Admin", "Admin"), ("Manager", "Manager"), ("TL", "Team Lead"), ("BDM", "BDM")], db_index=True, max_length=20)),
                ("page_key", models.CharField(db_index=True, max_length=64)),
                ("enabled", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["role", "page_key"],
                "unique_together": {("role", "page_key")},
            },
        ),
        migrations.RunPython(seed_page_permissions, unseed_page_permissions),
    ]
