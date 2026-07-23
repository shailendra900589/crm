from django.db.models.signals import post_save
from django.dispatch import receiver


def _broadcast(event):
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        layer = get_channel_layer()
        if not layer:
            return
        for group in ("dashboard_admin", "dashboard_bdm", "dashboard_manager"):
            async_to_sync(layer.group_send)(group, event)
        project_id = event.get("project_id")
        if project_id:
            async_to_sync(layer.group_send)(f"dashboard_project_{project_id}", event)
    except Exception:
        pass


def _notify_lead_watchers(lead, message, link=""):
    from .models import Notification, User

    watchers = {lead.bdm_id}
    if lead.bdm.reports_to_id:
        watchers.add(lead.bdm.reports_to_id)
        if lead.bdm.reports_to and lead.bdm.reports_to.reports_to_id:
            watchers.add(lead.bdm.reports_to.reports_to_id)
    for admin_id in User.objects.filter(role=User.Role.ADMIN, is_active_user=True).values_list("id", flat=True):
        watchers.add(admin_id)
    for uid in watchers:
        if uid:
            Notification.objects.create(user_id=uid, message=message, link=link)


@receiver(post_save)
def broadcast_change(sender, instance, **kwargs):
    from .audit import log_audit
    from .models import BulkUploadJob, FormSubmission, Lead, LeadDocument, LeadVisit, Team

    if sender not in (Lead, LeadDocument, Team, BulkUploadJob, LeadVisit, FormSubmission):
        return

    project_id = getattr(instance, "project_id", None)
    if sender == LeadDocument:
        project_id = instance.lead.project_id
    if sender in (LeadVisit, FormSubmission):
        project_id = instance.lead.project_id

    created = kwargs.get("created")

    if sender == Lead and created:
        _notify_lead_watchers(instance, f"New lead: {instance.merchant.name}", "/dashboard")
        log_audit(
            instance.bdm,
            action="lead.created",
            entity_type="Lead",
            entity_id=instance.id,
            message=f"Lead created: {instance.merchant.name}",
            meta={"project_id": instance.project_id, "status": instance.status},
        )
    elif sender == Lead and not created:
        log_audit(
            instance.bdm,
            action="lead.updated",
            entity_type="Lead",
            entity_id=instance.id,
            message=f"Lead updated: {instance.merchant.name} ({instance.status})",
            meta={"project_id": instance.project_id, "status": instance.status},
        )
    elif sender == LeadVisit and created:
        _notify_lead_watchers(
            instance.lead,
            f"Visit scheduled: {instance.lead.merchant.name} on {instance.scheduled_date}",
            "/dashboard",
        )
        log_audit(
            instance.assigned_by or instance.assigned_to,
            action="visit.scheduled",
            entity_type="LeadVisit",
            entity_id=instance.id,
            message=f"Visit scheduled for {instance.lead.merchant.name} on {instance.scheduled_date}",
            meta={"lead_id": instance.lead_id, "status": instance.status},
        )
    elif sender == LeadVisit and not created:
        log_audit(
            instance.assigned_to,
            action=f"visit.{instance.status}",
            entity_type="LeadVisit",
            entity_id=instance.id,
            message=f"Visit {instance.status}: {instance.lead.merchant.name}",
            meta={"lead_id": instance.lead_id, "status": instance.status},
        )
    elif sender == FormSubmission:
        _notify_lead_watchers(instance.lead, f"Form filled: {instance.lead.merchant.name}", "/dashboard")
        log_audit(
            instance.submitted_by,
            action="form.submitted",
            entity_type="FormSubmission",
            entity_id=instance.id,
            message=f"Form submitted for {instance.lead.merchant.name}",
            meta={"lead_id": instance.lead_id},
        )
    elif sender == LeadDocument:
        _notify_lead_watchers(instance.lead, f"Documents updated for {instance.lead.merchant.name}", "/leads")
        log_audit(
            instance.verified_by,
            action="document.updated",
            entity_type="LeadDocument",
            entity_id=instance.id,
            message=f"Documents {instance.verification_status} for {instance.lead.merchant.name}",
            meta={"lead_id": instance.lead_id, "status": instance.verification_status},
        )
    elif sender == Team and created:
        log_audit(
            instance.manager,
            action="team.created",
            entity_type="Team",
            entity_id=instance.id,
            message=f"Team created: {instance.name}",
            meta={"project_id": instance.project_id},
        )
    elif sender == BulkUploadJob:
        log_audit(
            None,
            action=f"bulk.{instance.status}",
            entity_type="BulkUploadJob",
            entity_id=instance.id,
            message=f"Bulk upload {instance.status} ({instance.success_rows}/{instance.total_rows})",
            meta={"project_id": getattr(instance, "project_id", None), "status": instance.status},
        )

    _broadcast({
        "type": "dashboard_update",
        "model": sender.__name__,
        "id": instance.id,
        "project_id": project_id,
        "job_id": instance.id if sender == BulkUploadJob else None,
    })
