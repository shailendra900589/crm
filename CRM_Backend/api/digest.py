"""Daily email digest for CRM users."""

from datetime import date

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail

from .models import Lead, LeadVisit, Notification
from .permissions import leads_for_user, my_assigned_visits

User = get_user_model()


def send_daily_digest(user_id=None):
    """Send daily digest emails. Returns summary dict."""
    if not getattr(settings, "DIGEST_ENABLED", True):
        return {"sent": 0, "skipped": 0, "errors": ["Digest disabled"], "detail": "disabled"}

    today = date.today()
    qs = User.objects.filter(is_active=True, is_active_user=True).exclude(email="")
    if user_id:
        qs = qs.filter(id=user_id)

    sent = 0
    skipped = 0
    errors = []
    frontend = getattr(settings, "FRONTEND_URL", "http://127.0.0.1:3000").rstrip("/")

    for user in qs.iterator():
        try:
            leads = leads_for_user(user)
            total = leads.count()
            confirmed = leads.filter(status=Lead.Status.ORDER_CONFIRMED).count()
            conversion = round((confirmed / total * 100) if total else 0, 1)
            due_today = list(
                leads.filter(follow_up_date=today)
                .select_related("merchant", "project")
                .order_by("merchant__name")[:15]
            )
            overdue = list(
                leads.filter(follow_up_date__lt=today)
                .exclude(status__in=[Lead.Status.ORDER_CONFIRMED, Lead.Status.NOT_INTERESTED])
                .select_related("merchant", "project")
                .order_by("follow_up_date")[:15]
            )
            visits = list(
                my_assigned_visits(user)
                .filter(status=LeadVisit.Status.SCHEDULED, scheduled_date__gte=today)
                .select_related("lead", "lead__merchant", "lead__project")
                .order_by("scheduled_date")[:10]
            )

            if user.role == User.Role.BDM and not due_today and not overdue and not visits:
                skipped += 1
                continue

            name = user.get_full_name() or user.username
            lines = [
                f"Good morning, {name}!",
                "",
                f"Your CRM digest for {today.isoformat()}",
                "",
                f"Leads in scope: {total}",
                f"Orders confirmed: {confirmed}",
                f"Conversion: {conversion}%",
                f"Follow-ups due today: {len(due_today)}",
                f"Overdue follow-ups: {len(overdue)}",
                f"Upcoming visits: {len(visits)}",
                "",
            ]

            if overdue:
                lines.append("OVERDUE FOLLOW-UPS")
                for lead in overdue:
                    lines.append(
                        f"  - {lead.merchant.name} ({lead.project.name}) - due {lead.follow_up_date}"
                    )
                lines.append("")

            if due_today:
                lines.append("DUE TODAY")
                for lead in due_today:
                    lines.append(f"  - {lead.merchant.name} ({lead.project.name})")
                lines.append("")

            if visits:
                lines.append("UPCOMING VISITS")
                for visit in visits:
                    lines.append(
                        f"  - {visit.scheduled_date}: {visit.lead.merchant.name} ({visit.lead.project.name})"
                    )
                lines.append("")

            lines.extend([
                f"Open dashboard: {frontend}/dashboard",
                f"Open leads: {frontend}/leads",
                "",
                "- Amazon Merchant CRM",
            ])
            body = "\n".join(lines)

            html_rows = []
            sections = [
                (
                    "Overdue follow-ups",
                    overdue,
                    lambda lead: f"{lead.merchant.name} | {lead.project.name} | due {lead.follow_up_date}",
                ),
                (
                    "Due today",
                    due_today,
                    lambda lead: f"{lead.merchant.name} | {lead.project.name}",
                ),
                (
                    "Upcoming visits",
                    visits,
                    lambda visit: (
                        f"{visit.scheduled_date}: {visit.lead.merchant.name} | {visit.lead.project.name}"
                    ),
                ),
            ]
            for title, items, fmt in sections:
                if not items:
                    continue
                html_rows.append(f"<h3 style='margin:16px 0 8px;color:#1e293b'>{title}</h3><ul>")
                for item in items:
                    html_rows.append(f"<li style='margin:4px 0;color:#334155'>{fmt(item)}</li>")
                html_rows.append("</ul>")

            html = f"""
            <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
              <h2 style="color:#4f46e5;margin-bottom:4px">Daily CRM Digest</h2>
              <p style="color:#64748b;margin-top:0">{today.isoformat()} | Hi {name}</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr>
                  <td style="padding:10px;background:#f8fafc;border-radius:8px;text-align:center">
                    <div style="font-size:22px;font-weight:700">{total}</div>
                    <div style="font-size:11px;color:#64748b;text-transform:uppercase">Leads</div>
                  </td>
                  <td style="width:8px"></td>
                  <td style="padding:10px;background:#ecfdf5;border-radius:8px;text-align:center">
                    <div style="font-size:22px;font-weight:700;color:#059669">{confirmed}</div>
                    <div style="font-size:11px;color:#64748b;text-transform:uppercase">Confirmed</div>
                  </td>
                  <td style="width:8px"></td>
                  <td style="padding:10px;background:#fff7ed;border-radius:8px;text-align:center">
                    <div style="font-size:22px;font-weight:700;color:#d97706">{len(overdue)}</div>
                    <div style="font-size:11px;color:#64748b;text-transform:uppercase">Overdue</div>
                  </td>
                </tr>
              </table>
              {''.join(html_rows)}
              <p style="margin-top:24px">
                <a href="{frontend}/dashboard" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open Dashboard</a>
              </p>
              <p style="color:#94a3b8;font-size:12px;margin-top:24px">Amazon Merchant CRM</p>
            </div>
            """

            send_mail(
                subject=f"CRM Digest | {today.isoformat()} | {len(overdue)} overdue",
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=html,
                fail_silently=False,
            )
            Notification.objects.create(
                user=user,
                message=(
                    f"Daily digest sent to {user.email} "
                    f"({len(overdue)} overdue, {len(due_today)} due today)."
                ),
                link="/dashboard",
            )
            sent += 1
        except Exception as exc:
            errors.append({"user": user.username, "error": str(exc)})

    return {"sent": sent, "skipped": skipped, "errors": errors}
