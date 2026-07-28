from django.core.management.base import BaseCommand

from api.auth_login import (
    PLATFORM_SUPERADMIN_PASSWORD,
    PLATFORM_SUPERADMIN_USERNAME,
    ensure_platform_superadmin,
)


class Command(BaseCommand):
    help = "Create/repair platform Super Admin (Rahul) so login works without full seed."

    def handle(self, *args, **options):
        user = ensure_platform_superadmin()
        self.stdout.write(
            self.style.SUCCESS(
                f"Super Admin ready: {PLATFORM_SUPERADMIN_USERNAME} / {PLATFORM_SUPERADMIN_PASSWORD} "
                f"(id={user.id}, role={user.role}, active={user.is_active})"
            )
        )
