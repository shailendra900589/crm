from django.core.management.base import BaseCommand

from api.digest import send_daily_digest
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Send daily CRM email digests (overdue follow-ups, due today, upcoming visits)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--user",
            dest="username",
            help="Send digest only to this username",
        )

    def handle(self, *args, **options):
        user_id = None
        username = options.get("username")
        if username:
            user = User.objects.filter(username=username).first()
            if not user:
                self.stderr.write(self.style.ERROR(f"User not found: {username}"))
                return
            user_id = user.id

        result = send_daily_digest(user_id=user_id)
        self.stdout.write(
            self.style.SUCCESS(
                f"Digest done — sent={result.get('sent')} skipped={result.get('skipped')} "
                f"errors={len(result.get('errors') or [])}"
            )
        )
        for err in result.get("errors") or []:
            self.stderr.write(self.style.WARNING(f"  {err}"))
