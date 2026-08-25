"""Public forgot-password OTP flow (SMTP)."""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .mailer import send_password_reset_otp_email
from .models import PasswordResetOTP

User = get_user_model()
logger = logging.getLogger(__name__)

GENERIC_SENT = "If an account exists for that username or email, an OTP has been sent."
MAX_ATTEMPTS = 5


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


def _find_user(identifier: str):
    ident = (identifier or "").strip()
    if not ident:
        return None
    return (
        User.objects.filter(Q(username__iexact=ident) | Q(email__iexact=ident))
        .order_by("id")
        .first()
    )


def _otp_minutes() -> int:
    return int(getattr(settings, "PASSWORD_RESET_OTP_MINUTES", 15) or 15)


class ForgotPasswordRequestView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = (
            request.data.get("identifier")
            or request.data.get("username")
            or request.data.get("email")
            or ""
        ).strip()
        if not identifier:
            return Response(
                {"detail": "Username or email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = _find_user(identifier)
        # Always return same message (no account enumeration)
        if not user or not user.email:
            return Response({"detail": GENERIC_SENT})

        # Throttle: one active OTP per 60s
        recent = (
            PasswordResetOTP.objects.filter(user=user, used_at__isnull=True)
            .order_by("-created_at")
            .first()
        )
        if recent and (timezone.now() - recent.created_at).total_seconds() < 60:
            return Response({"detail": GENERIC_SENT, "email_hint": _mask_email(user.email)})

        otp = f"{secrets.randbelow(1_000_000):06d}"
        minutes = _otp_minutes()
        PasswordResetOTP.objects.filter(user=user, used_at__isnull=True).update(
            used_at=timezone.now()
        )
        PasswordResetOTP.objects.create(
            user=user,
            otp_hash=_hash_otp(otp),
            expires_at=timezone.now() + timedelta(minutes=minutes),
        )
        try:
            send_password_reset_otp_email(
                to_email=user.email,
                username=user.username,
                otp=otp,
                minutes=minutes,
            )
        except Exception:
            logger.exception("Password reset OTP email failed for user=%s", user.pk)
            return Response(
                {"detail": "Could not send OTP email. Try again later."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"detail": GENERIC_SENT, "email_hint": _mask_email(user.email)})


class ForgotPasswordConfirmView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = (
            request.data.get("identifier")
            or request.data.get("username")
            or request.data.get("email")
            or ""
        ).strip()
        otp = (request.data.get("otp") or "").strip().replace(" ", "")
        new_password = request.data.get("new_password") or ""
        confirm = request.data.get("confirm_password") or new_password

        if not identifier or not otp:
            return Response(
                {"detail": "Username/email and OTP are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(new_password) < 6:
            return Response(
                {"detail": "New password must be at least 6 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_password != confirm:
            return Response(
                {"detail": "New password and confirmation do not match."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = _find_user(identifier)
        if not user:
            return Response({"detail": "Invalid OTP or account."}, status=status.HTTP_400_BAD_REQUEST)

        row = (
            PasswordResetOTP.objects.filter(user=user, used_at__isnull=True)
            .order_by("-created_at")
            .first()
        )
        if not row or row.expires_at < timezone.now():
            return Response(
                {"detail": "OTP expired. Request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if row.attempts >= MAX_ATTEMPTS:
            return Response(
                {"detail": "Too many attempts. Request a new OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if row.otp_hash != _hash_otp(otp):
            row.attempts += 1
            row.save(update_fields=["attempts"])
            return Response({"detail": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        row.used_at = timezone.now()
        row.save(update_fields=["used_at"])
        PasswordResetOTP.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())

        try:
            from .models import Notification

            Notification.objects.create(
                user=user,
                message="Your password was reset via email OTP.",
                link="/login",
            )
        except Exception:
            pass

        return Response({"detail": "Password updated. You can sign in now."})


def _mask_email(email: str) -> str:
    try:
        local, domain = email.split("@", 1)
        if len(local) <= 2:
            masked = local[0] + "*"
        else:
            masked = local[0] + "***" + local[-1]
        return f"{masked}@{domain}"
    except Exception:
        return "***"
