from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0016_formsubmission_unique_and_submitted_at"),
    ]

    operations = [
        migrations.CreateModel(
            name="SubscriptionPackage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("slug", models.SlugField(unique=True)),
                ("description", models.TextField(blank=True)),
                ("price", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("currency", models.CharField(default="INR", max_length=8)),
                ("trial_days", models.PositiveIntegerField(default=15)),
                ("module_keys", models.JSONField(blank=True, default=list)),
                ("is_active", models.BooleanField(default=True)),
                ("is_default", models.BooleanField(default=False, help_text="Assigned to new trial companies")),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["sort_order", "price", "name"],
            },
        ),
        migrations.AddField(
            model_name="organization",
            name="amount_paid",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="organization",
            name="enabled_modules",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Module keys this company may use (Super Admin / package controlled)",
            ),
        ),
        migrations.AddField(
            model_name="organization",
            name="package_assigned_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="organization",
            name="paid_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="organization",
            name="payment_status",
            field=models.CharField(
                choices=[("none", "No payment"), ("pending", "Payment pending"), ("paid", "Paid")],
                db_index=True,
                default="none",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="organization",
            name="package",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="organizations",
                to="api.subscriptionpackage",
            ),
        ),
    ]
