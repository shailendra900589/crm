"""Lightweight audit logging helper."""

from .models import AuditLog


def log_audit(actor=None, *, action, entity_type, entity_id=None, message="", meta=None):
    try:
        AuditLog.objects.create(
            actor=actor if getattr(actor, "pk", None) else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            message=(message or action)[:500],
            meta=meta or {},
        )
    except Exception:
        # Never break business flows because of audit write failures.
        pass
