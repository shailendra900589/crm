from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_verified(apps, schema_editor):
    Organization = apps.get_model("api", "Organization")
    Organization.objects.exclude(status="pending").update(docs_verification_status="verified")


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0017_subscription_packages_entitlements"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="organization",
            name="docs_rejection_reason",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="organization",
            name="docs_verification_status",
            field=models.CharField(
                choices=[
                    ("pending", "Awaiting documents"),
                    ("in_review", "Under Super Admin review"),
                    ("verified", "Corporate docs verified"),
                    ("rejected", "Documents rejected"),
                ],
                db_index=True,
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="organization",
            name="docs_verified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="organization",
            name="docs_verified_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="orgs_docs_verified",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.CreateModel(
            name="OrganizationDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "doc_type",
                    models.CharField(
                        choices=[
                            ("gst_certificate", "GST certificate"),
                            ("pan_card", "Company PAN"),
                            ("incorporation", "Certificate of incorporation"),
                            ("address_proof", "Address proof"),
                            ("cancelled_cheque", "Cancelled cheque"),
                            ("other", "Other"),
                        ],
                        default="other",
                        max_length=40,
                    ),
                ),
                ("label", models.CharField(blank=True, max_length=160)),
                ("file", models.FileField(upload_to="org_docs/%Y/%m/")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending review"),
                            ("approved", "Approved"),
                            ("rejected", "Rejected"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("notes", models.TextField(blank=True)),
                ("verified_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="documents",
                        to="api.organization",
                    ),
                ),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="org_docs_uploaded",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "verified_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="org_docs_reviewed",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.RunPython(backfill_verified, migrations.RunPython.noop),
    ]
