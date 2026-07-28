"""Trackbook HRMS ↔ CRM Pro SSO (HMAC ticket + JWT exchange)."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from base64 import urlsafe_b64decode, urlsafe_b64encode
from typing import Any

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Organization

logger = logging.getLogger(__name__)
User = get_user_model()


def _b64e(raw: bytes) -> str:
    return urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64d(raw: str) -> bytes:
    pad = "=" * (-len(raw) % 4)
    return urlsafe_b64decode(raw + pad)


def _sso_secret() -> bytes:
    raw = (getattr(settings, "CRM_PRO_SSO_SECRET", None) or "").strip()
    if not raw:
        raw = str(getattr(settings, "SECRET_KEY", "") or "trackbook-crm-pro-sso")
    return raw.encode("utf-8")


def validate_ticket_local(ticket: str) -> dict[str, Any]:
    """Validate HMAC ticket issued by HRMS (same algorithm as users/crm_pro_sso.py)."""
    raw = (ticket or "").strip()
    if not raw or "." not in raw:
        raise ValueError("Invalid SSO ticket.")
    body, sig = raw.rsplit(".", 1)
    expected = _b64e(hmac.new(_sso_secret(), body.encode("ascii"), hashlib.sha256).digest())
    if not hmac.compare_digest(expected, sig):
        raise ValueError("SSO ticket signature mismatch.")
    try:
        payload = json.loads(_b64d(body).decode("utf-8"))
    except Exception as exc:
        raise ValueError("SSO ticket payload is invalid.") from exc
    if not isinstance(payload, dict):
        raise ValueError("SSO ticket payload is invalid.")
    import time

    exp = int(payload.get("exp") or 0)
    if exp < int(time.time()):
        raise ValueError("SSO ticket expired.")
    return payload


def validate_ticket_via_hrms(ticket: str) -> dict[str, Any]:
    """Fallback: ask HRMS to validate the ticket."""
    base = (getattr(settings, "HRMS_API_BASE_URL", None) or "https://hrms.trackbook.co").rstrip("/")
    url = f"{base}/api/users/integrations/crm-pro/validate-sso/"
    try:
        res = requests.post(url, json={"ticket": ticket}, timeout=12)
    except requests.RequestException as exc:
        raise ValueError(f"Could not reach HRMS to validate SSO ({exc}).") from exc
    if res.status_code >= 400:
        detail = ""
        try:
            detail = (res.json() or {}).get("detail") or ""
        except Exception:
            detail = res.text[:200]
        raise ValueError(detail or "HRMS rejected SSO ticket.")
    data = res.json() if res.content else {}
    if not data.get("valid"):
        raise ValueError("HRMS reported SSO ticket invalid.")
    user = data.get("user")
    if not isinstance(user, dict):
        raise ValueError("HRMS SSO response missing user payload.")
    return user


def validate_trackbook_sso_ticket(ticket: str) -> dict[str, Any]:
    try:
        return validate_ticket_local(ticket)
    except ValueError as local_err:
        try:
            return validate_ticket_via_hrms(ticket)
        except ValueError:
            raise local_err


def _map_hrms_role(hrms_role: str) -> str:
    role = (hrms_role or "").strip().upper()
    if role in ("SUPER_ADMIN", "SUPERADMIN"):
        return User.Role.SUPERADMIN
    if role in ("COMPANY_ADMIN", "ADMIN"):
        return User.Role.ADMIN
    if role in ("MANAGER",):
        return User.Role.MANAGER
    if role in ("TL", "TEAM_LEAD", "TEAMLEAD"):
        return User.Role.TL
    return User.Role.BDM


def resolve_crm_user(payload: dict[str, Any], *, auto_provision: bool = True) -> User:
    """Find CRM user linked to HRMS identity; optionally provision into linked org."""
    hrms_uid = str(payload.get("hrms_user_id") or "").strip()
    company_id = str(payload.get("company_id") or "").strip()
    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip()
    phone = (payload.get("phone") or "").strip()

    qs = User.objects.filter(is_active=True)
    if hrms_uid:
        user = qs.filter(hrms_user_id=hrms_uid).first()
        if user:
            return user

    org = None
    if company_id:
        org = Organization.objects.filter(hrms_company_id=company_id).first()

    if org and username:
        user = qs.filter(organization=org, username__iexact=username).first()
        if user:
            if hrms_uid and user.hrms_user_id != hrms_uid:
                user.hrms_user_id = hrms_uid
                user.save(update_fields=["hrms_user_id"])
            return user

    if org and email:
        user = qs.filter(organization=org, email__iexact=email).first()
        if user:
            if hrms_uid and not user.hrms_user_id:
                user.hrms_user_id = hrms_uid
                user.save(update_fields=["hrms_user_id"])
            return user

    if username:
        user = qs.filter(username__iexact=username).first()
        if user:
            if hrms_uid and not user.hrms_user_id:
                user.hrms_user_id = hrms_uid
                user.save(update_fields=["hrms_user_id"])
            return user

    if not auto_provision or not org or not username:
        raise ValueError(
            "No CRM user linked to this Trackbook account. "
            "Ask CRM Admin → Organizations → Sync HRMS employees."
        )

    if not org.is_access_allowed:
        raise ValueError("CRM organization is not active for this company.")

    mapped_role = _map_hrms_role(str(payload.get("role") or ""))
    # Prefer unique username; fall back if collision.
    final_username = username
    if User.objects.filter(username__iexact=final_username).exists():
        final_username = f"{username}.hrms{hrms_uid or 'x'}"[:140]

    user = User(
        username=final_username,
        email=email or f"{final_username}@trackbook.local",
        first_name=(payload.get("first_name") or "")[:150],
        last_name=(payload.get("last_name") or "")[:150],
        role=mapped_role,
        organization=org,
        hrms_user_id=hrms_uid,
        mobile_number=phone[:15],
        is_active=True,
        is_active_user=True,
        crm_pro_mobile_enabled=True,
    )
    user.set_unusable_password()
    user.save()
    logger.info("Provisioned CRM user %s from HRMS SSO (org=%s)", user.username, org.pk)
    return user


def issue_crm_tokens(user: User) -> dict[str, str]:
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }
