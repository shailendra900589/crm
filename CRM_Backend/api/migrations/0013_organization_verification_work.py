from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def seed_default_org(apps, schema_editor):
    """Use SQL so we never hit a live-model / half-migrated ORM mismatch."""
    from django.utils import timezone

    now = timezone.now()
    conn = schema_editor.connection
    with conn.cursor() as cursor:
        cursor.execute("SELECT id FROM api_organization WHERE slug = %s", ["default"])
        row = cursor.fetchone()
        if row:
            org_id = row[0]
        else:
            cursor.execute(
                """
                INSERT INTO api_organization (
                    name, slug, email, phone, city, status, plan_label, trial_ends_at,
                    payment_notes, hrms_connected, hrms_company_id, hrms_api_base_url,
                    admin_name, is_public, created_at, approved_at, approved_by_id
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, NULL,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, NULL
                ) RETURNING id
                """,
                [
                    "Default Company",
                    "default",
                    "admin@crm.local",
                    "",
                    "",
                    "active",
                    "Legacy",
                    "",
                    False,
                    "",
                    "https://hrms.trackbook.co",
                    "",
                    True,
                    now,
                    now,
                ],
            )
            org_id = cursor.fetchone()[0]

        cursor.execute(
            "UPDATE api_project SET organization_id = %s WHERE organization_id IS NULL",
            [org_id],
        )
        cursor.execute(
            "UPDATE api_user SET organization_id = %s WHERE organization_id IS NULL AND COALESCE(role, '') <> %s",
            [org_id, "SuperAdmin"],
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0012_customform_enable_collection"),
    ]

    operations = [
        migrations.CreateModel(
            name="Organization",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("slug", models.SlugField(unique=True)),
                ("email", models.EmailField(max_length=254)),
                ("phone", models.CharField(blank=True, max_length=20)),
                ("city", models.CharField(blank=True, max_length=100)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending approval"),
                            ("trial", "Trial"),
                            ("active", "Active (paid)"),
                            ("suspended", "Suspended"),
                            ("rejected", "Rejected"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("plan_label", models.CharField(blank=True, default="Trial", max_length=120)),
                ("trial_ends_at", models.DateTimeField(blank=True, null=True)),
                ("payment_notes", models.TextField(blank=True, help_text="Super Admin payment / commercial notes")),
                ("hrms_connected", models.BooleanField(default=False)),
                ("hrms_company_id", models.CharField(blank=True, max_length=64)),
                ("hrms_api_base_url", models.URLField(blank=True, default="https://hrms.trackbook.co")),
                ("admin_name", models.CharField(blank=True, max_length=120)),
                (
                    "is_public",
                    models.BooleanField(default=False, help_text="Published by Super Admin for signup visibility"),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                (
                    "approved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="orgs_approved",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.AddField(
            model_name="project",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="projects",
                to="api.organization",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="users",
                to="api.organization",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="hrms_user_id",
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
        migrations.AddField(
            model_name="user",
            name="can_edit_leads",
            field=models.BooleanField(
                default=True,
                help_text="When True, user may edit lead/form data (subject to hierarchy).",
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("SuperAdmin", "Super Admin"),
                    ("Admin", "Admin"),
                    ("Manager", "Manager"),
                    ("TL", "Team Lead"),
                    ("BDM", "BDM"),
                    ("Ops", "Office Ops"),
                ],
                default="BDM",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="VerificationWork",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(default="Verify documents", max_length=200)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("open", "Open (unassigned)"),
                            ("assigned", "Assigned"),
                            ("in_progress", "In progress"),
                            ("done", "Completed"),
                            ("rejected", "Rejected"),
                            ("reopened", "Reopened"),
                        ],
                        db_index=True,
                        default="open",
                        max_length=20,
                    ),
                ),
                (
                    "priority",
                    models.CharField(
                        choices=[("normal", "Normal"), ("high", "High"), ("urgent", "Urgent")],
                        default="normal",
                        max_length=20,
                    ),
                ),
                ("due_date", models.DateField(blank=True, null=True)),
                ("assign_notes", models.TextField(blank=True)),
                ("completion_notes", models.TextField(blank=True)),
                (
                    "allow_edit",
                    models.BooleanField(
                        default=True,
                        help_text="Assignee may edit lead form answers while working this task.",
                    ),
                ),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "assigned_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="verification_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "assigned_to",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="verification_assigned",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "document",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="verification_works",
                        to="api.leaddocument",
                    ),
                ),
                (
                    "form_submission",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="verification_works",
                        to="api.formsubmission",
                    ),
                ),
                (
                    "lead",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="verification_works",
                        to="api.lead",
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="verification_works",
                        to="api.organization",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.RunPython(seed_default_org, noop_reverse),
    ]
