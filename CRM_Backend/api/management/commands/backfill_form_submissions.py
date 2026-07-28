from django.core.management.base import BaseCommand

from api.form_sync import sync_lead_form_data
from api.models import Lead


class Command(BaseCommand):
    help = "Backfill FormSubmission + verification from Lead.custom_data for all leads with answers."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=2000)

    def handle(self, *args, **options):
        limit = options["limit"]
        qs = Lead.objects.exclude(custom_data={}).exclude(custom_data__isnull=True).select_related(
            "project", "project__custom_form", "bdm"
        )[:limit]
        n = 0
        for lead in qs:
            data = lead.custom_data or {}
            if not data:
                continue
            try:
                sync_lead_form_data(lead, data, actor=lead.bdm, bump_submitted_at=False)
                n += 1
            except Exception as exc:
                self.stderr.write(f"Lead {lead.id}: {exc}")
        self.stdout.write(self.style.SUCCESS(f"Synced {n} leads with form data → FormSubmission + verification"))
