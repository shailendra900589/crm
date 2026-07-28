from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0011_crm_pro_mobile_access"),
    ]

    operations = [
        migrations.AddField(
            model_name="customform",
            name="enable_collection",
            field=models.BooleanField(
                default=False,
                help_text="Show Amount Collected / payment fields on this form for BDMs.",
            ),
        ),
    ]
