"""Outgoing email helpers for Trackbook CRM (forgot-password OTP, registration, digests)."""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def send_crm_email(
    *,
    subject: str,
    to: str | list[str],
    text: str,
    html: str | None = None,
    fail_silently: bool = False,
) -> bool:
    recipients = [to] if isinstance(to, str) else [e for e in to if e]
    recipients = [e.strip() for e in recipients if e and str(e).strip()]
    if not recipients:
        logger.warning("send_crm_email skipped: no recipients (%s)", subject)
        return False
    try:
        send_mail(
            subject=subject,
            message=text,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            html_message=html,
            fail_silently=fail_silently,
        )
        return True
    except Exception:
        logger.exception("Failed to send email: %s → %s", subject, recipients)
        if fail_silently:
            return False
        raise


def send_password_reset_otp_email(*, to_email: str, username: str, otp: str, minutes: int) -> bool:
    subject = "Trackbook CRM — Password reset OTP"
    text = (
        f"Hello {username},\n\n"
        f"Your password reset OTP is: {otp}\n\n"
        f"This code expires in {minutes} minutes. If you did not request a reset, ignore this email.\n\n"
        f"— Trackbook CRM\n"
    )
    html = f"""
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 8px;color:#0B3D4A">Password reset</h2>
      <p style="color:#475569">Hello <strong>{username}</strong>, use this one-time code:</p>
      <p style="font-size:28px;letter-spacing:6px;font-weight:800;color:#0B3D4A;margin:20px 0">{otp}</p>
      <p style="color:#64748b;font-size:14px">Expires in {minutes} minutes. Do not share this code.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:28px">Trackbook CRM · {settings.FRONTEND_URL}</p>
    </div>
    """
    return send_crm_email(subject=subject, to=to_email, text=text, html=html, fail_silently=False)


def send_registration_success_email(
    *,
    to_email: str,
    company_name: str,
    username: str,
    otp: str,
) -> bool:
    """Confirmation + OTP after public company registration (support / verification reference)."""
    subject = "Trackbook CRM — Registration received"
    frontend = getattr(settings, "FRONTEND_URL", "https://crm.trackbook.co")
    text = (
        f"Hello,\n\n"
        f"Your company registration for “{company_name}” was received successfully.\n"
        f"Login username: {username}\n"
        f"Confirmation OTP: {otp}\n\n"
        f"Super Admin will verify your corporate documents before CRM access is enabled.\n"
        f"Login: {frontend}/login\n\n"
        f"— Trackbook CRM\n"
    )
    html = f"""
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 8px;color:#0B3D4A">Registration received</h2>
      <p style="color:#475569">
        Company <strong>{company_name}</strong> is registered. Username: <strong>{username}</strong>.
      </p>
      <p style="color:#475569;margin-top:16px">Your confirmation OTP:</p>
      <p style="font-size:28px;letter-spacing:6px;font-weight:800;color:#0B3D4A;margin:12px 0">{otp}</p>
      <p style="color:#64748b;font-size:14px">
        Keep this code for support. Document verification is required before login is enabled.
      </p>
      <p style="margin-top:24px">
        <a href="{frontend}/login"
           style="background:#0B3D4A;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">
          Go to login
        </a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin-top:28px">Trackbook CRM</p>
    </div>
    """
    return send_crm_email(subject=subject, to=to_email, text=text, html=html, fail_silently=True)
