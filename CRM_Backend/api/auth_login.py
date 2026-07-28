"""CRM login helpers — platform Super Admin + JWT token obtain."""

from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
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
        user = User.objects.create_user(
            username=PLATFORM_SUPERADMIN_USERNAME,
            email=PLATFORM_SUPERADMIN_EMAIL,
            password=PLATFORM_SUPERADMIN_PASSWORD,
            first_name="Rahul",
            role=User.Role.SUPERADMIN,
            is_staff=True,
            is_superuser=True,
            is_active=True,
            is_active_user=True,
        )
        user.organization = None
        user.save(update_fields=["organization"])
    else:
        update_fields = []
        user.username = PLATFORM_SUPERADMIN_USERNAME
        if user.role != User.Role.SUPERADMIN:
            user.role = User.Role.SUPERADMIN
            update_fields.append("role")
        if user.organization_id is not None:
            user.organization = None
            update_fields.append("organization")
        if not user.is_active:
            user.is_active = True
            update_fields.append("is_active")
        if not user.is_active_user:
            user.is_active_user = True
            update_fields.append("is_active_user")
        if not user.is_staff:
            user.is_staff = True
            update_fields.append("is_staff")
        if not user.is_superuser:
            user.is_superuser = True
            update_fields.append("is_superuser")
        if user.first_name != "Rahul":
            user.first_name = "Rahul"
            update_fields.append("first_name")
        if user.email != PLATFORM_SUPERADMIN_EMAIL:
            user.email = PLATFORM_SUPERADMIN_EMAIL
            update_fields.append("email")
        if not user.check_password(PLATFORM_SUPERADMIN_PASSWORD):
            user.set_password(PLATFORM_SUPERADMIN_PASSWORD)
            update_fields.append("password")
        if update_fields:
            user.save(update_fields=list(dict.fromkeys(update_fields)))

    User.objects.filter(username__iexact="superadmin").exclude(pk=user.pk).update(
        is_active=False,
        is_active_user=False,
    )
    # Fresh instance for password checks
    return User.objects.get(pk=user.pk)


class CRMTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Direct password check + token issue (does not rely on Django authenticate()).
    Always repairs platform Super Admin before validating Rahul credentials.
    """

    def validate(self, attrs):
        try:
            ensure_platform_superadmin()
        except Exception:
            pass

        raw_username = (attrs.get(self.username_field) or "").strip()
        password = attrs.get("password") or ""
        if not raw_username or not password:
            raise AuthenticationFailed(
                "No active account found with the given credentials",
                code="no_active_account",
            )

        user = User.objects.filter(username__iexact=raw_username).first()
        if user is None or not user.check_password(password):
            raise AuthenticationFailed(
                "No active account found with the given credentials",
                code="no_active_account",
            )

        if not user.is_active or not getattr(user, "is_active_user", True):
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

        refresh = RefreshToken.for_user(user)
        self.user = user
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "role": user.role,
            "username": user.username,
        }


class CRMTokenObtainPairView(TokenObtainPairView):
    serializer_class = CRMTokenObtainPairSerializer
