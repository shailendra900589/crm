from django.core.management.base import BaseCommand

from api.form_sync import scrub_seed_form_junk
from api.models import Lead


class Command(BaseCommand):
    help = "Remove legacy seed form junk (GST4000 / Retail) so BDM forms show real submits only."

    def handle(self, *args, **options):
        n = 0
        for lead in Lead.objects.all().iterator():
            if scrub_seed_form_junk(lead):
                n += 1
        self.stdout.write(self.style.SUCCESS(f"Cleaned seed form junk from {n} leads"))
