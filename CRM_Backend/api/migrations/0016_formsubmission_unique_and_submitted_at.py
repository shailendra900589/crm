# Generated manually for FormSubmission uniqueness + bumpable submitted_at

from django.db import migrations, models
import django.utils.timezone


def dedupe_form_submissions(apps, schema_editor):
    FormSubmission = apps.get_model("api", "FormSubmission")
    seen = set()
    for sub in FormSubmission.objects.order_by("-submitted_at", "-id").iterator():
        key = (sub.lead_id, sub.custom_form_id)
        if key in seen:
            sub.delete()
        else:
            seen.add(key)


def backfill_submissions_from_custom_data(apps, schema_editor):
    """Leads that already have form answers but no FormSubmission row → create one."""
    Lead = apps.get_model("api", "Lead")
    CustomForm = apps.get_model("api", "CustomForm")
    FormSubmission = apps.get_model("api", "FormSubmission")
    forms_by_project = {f.project_id: f for f in CustomForm.objects.all()}
    for lead in Lead.objects.all().iterator():
        data = lead.custom_data or {}
        if not isinstance(data, dict) or not data:
            continue
        form = forms_by_project.get(lead.project_id)
        if not form:
            continue
        if FormSubmission.objects.filter(lead_id=lead.id, custom_form_id=form.id).exists():
            continue
        FormSubmission.objects.create(
            lead_id=lead.id,
            custom_form_id=form.id,
            submitted_by_id=lead.bdm_id,
            answers=data,
            submitted_at=getattr(lead, "updated_at", None) or django.utils.timezone.now(),
        )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0015_alter_rolepagepermission_role"),
    ]

    operations = [
        migrations.RunPython(dedupe_form_submissions, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="formsubmission",
            name="submitted_at",
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddConstraint(
            model_name="formsubmission",
            constraint=models.UniqueConstraint(
                fields=("lead", "custom_form"),
                name="uniq_formsubmission_lead_form",
            ),
        ),
        migrations.RunPython(backfill_submissions_from_custom_data, migrations.RunPython.noop),
    ]
