from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0020_organization_roles"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="fresh_direct_enabled",
            field=models.BooleanField(
                default=False,
                help_text="When enabled, the mobile app shows Fresh Direct (create a lead from the form). Off = form only for existing leads.",
            ),
        ),
    ]
