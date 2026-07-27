from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0010_role_page_permission"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="crm_pro_mobile_enabled",
            field=models.BooleanField(
                default=False,
                help_text="When enabled, BDM/TL/Manager users on this project can open CRM Pro in Trackbook mobile.",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="crm_pro_mobile_enabled",
            field=models.BooleanField(
                blank=True,
                default=None,
                help_text="Override CRM Pro mobile access. Null = inherit from assigned projects.",
                null=True,
            ),
        ),
    ]
