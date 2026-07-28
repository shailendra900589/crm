"""CRM login helpers — platform Super Admin + JWT token obtain."""

from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

User = get_user_model()

# Canonical platform Super Admin (same login page as everyone else)
PLATFORM_SUPERADMIN_USERNAME = "Rahul"
PLATFORM_SUPERADMIN_PASSWORD = "India@1432"
PLATFORM_SUPERADMIN_EMAIL = "rahul@crm.local"


def ensure_platform_superadmin() -> User:
    """
    Idempotently create/repair Super Admin Rahul so platform login always works
    even if seed was never run on the server.
    """
    user = User.objects.filter(username__iexact=PLATFORM_SUPERADMIN_USERNAME).first()
    if not user:
        user = User(username=PLATFORM_SUPERADMIN_USERNAME)

    changed = user.pk is None
    user.username = PLATFORM_SUPERADMIN_USERNAME
    if user.role != User.Role.SUPERADMIN:
        user.role = User.Role.SUPERADMIN
        changed = True
    if user.organization_id is not None:
        user.organization = None
        changed = True
    if not user.is_active:
        user.is_active = True
        changed = True
    if not user.is_active_user:
        user.is_active_user = True
        changed = True
    if not user.is_staff:
        user.is_staff = True
        changed = True
    if not user.is_superuser:
        user.is_superuser = True
        changed = True
    if not user.first_name:
        user.first_name = "Rahul"
        changed = True
    if user.email != PLATFORM_SUPERADMIN_EMAIL:
        user.email = PLATFORM_SUPERADMIN_EMAIL
        changed = True

    # Keep password in sync with the published Super Admin credential
    if user.pk is None or not user.check_password(PLATFORM_SUPERADMIN_PASSWORD):
        user.set_password(PLATFORM_SUPERADMIN_PASSWORD)
        changed = True

    if changed:
        user.save()

    # Retire legacy seed account so only Rahul is the platform login
    User.objects.filter(username__iexact="superadmin").exclude(pk=user.pk).update(
        is_active=False,
        is_active_user=False,
    )
    return user


class CRMTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Case-insensitive username + Super Admin auto-provision + active-user gate."""

    def validate(self, attrs):
        # Ensure platform Super Admin exists before auth (fixes missing seed on EC2)
        try:
            ensure_platform_superadmin()
        except Exception:
            # Never block normal logins if ensure fails (e.g. mid-migrate)
            pass

        raw_username = (attrs.get(self.username_field) or "").strip()
        password = attrs.get("password") or ""
        if not raw_username or not password:
            raise AuthenticationFailed(
                "No active account found with the given credentials",
                code="no_active_account",
            )

        # Resolve case-insensitive username to the canonical DB value
        match = User.objects.filter(username__iexact=raw_username).first()
        if match:
            attrs[self.username_field] = match.username

        data = super().validate(attrs)
        user = self.user

        if not getattr(user, "is_active_user", True):
            raise AuthenticationFailed(
                "This account is deactivated. Contact your Admin.",
                code="user_inactive",
            )

        org = getattr(user, "organization", None)
        if user.role == User.Role.ADMIN and org is not None and getattr(org, "status", None) == "pending":
            raise AuthenticationFailed(
                "Company registration is pending Super Admin approval.",
                code="org_pending",
            )

        data["role"] = user.role
        data["username"] = user.username
        return data


class CRMTokenObtainPairView(TokenObtainPairView):
    serializer_class = CRMTokenObtainPairSerializer
