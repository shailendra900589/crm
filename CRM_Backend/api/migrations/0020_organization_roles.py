# Generated for OrganizationRole + User.organization_role

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0019_password_reset_otp"),
    ]

    operations = [
        migrations.CreateModel(
            name="OrganizationRole",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80)),
                ("slug", models.SlugField(max_length=80)),
                ("description", models.CharField(blank=True, default="", max_length=255)),
                (
                    "base_role",
                    models.CharField(
                        choices=[("Manager", "Manager"), ("TL", "Team Lead"), ("BDM", "BDM"), ("Ops", "Office Ops")],
                        default="BDM",
                        max_length=20,
                    ),
                ),
                ("is_system", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="roles",
                        to="api.organization",
                    ),
                ),
            ],
            options={
                "ordering": ["-is_system", "name"],
                "unique_together": {("organization", "slug")},
            },
        ),
        migrations.CreateModel(
            name="OrganizationRolePagePermission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("page_key", models.CharField(db_index=True, max_length=64)),
                ("enabled", models.BooleanField(default=True)),
                (
                    "role",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="page_permissions",
                        to="api.organizationrole",
                    ),
                ),
            ],
            options={
                "ordering": ["page_key"],
                "unique_together": {("role", "page_key")},
            },
        ),
        migrations.AddField(
            model_name="user",
            name="organization_role",
            field=models.ForeignKey(
                blank=True,
                help_text="Custom / org role for page permissions. Hierarchy still uses User.role (base capability).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="users",
                to="api.organizationrole",
            ),
        ),
    ]
