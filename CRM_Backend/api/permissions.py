from collections import deque

from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()


def is_admin(user):
    return user.role == User.Role.ADMIN


def is_manager(user):
    return user.role == User.Role.MANAGER


def is_manager_or_admin(user):
    return user.role in (User.Role.ADMIN, User.Role.MANAGER, User.Role.TL)


def get_descendant_ids(user):
    """All users in the reporting chain below this user (recursive)."""
    ids = set()
    queue = deque(User.objects.filter(reports_to=user).values_list("id", flat=True))
    while queue:
        uid = queue.popleft()
        if uid in ids:
            continue
        ids.add(uid)
        queue.extend(User.objects.filter(reports_to_id=uid).values_list("id", flat=True))
    return ids


def users_for_user(user):
    """Users visible in hierarchy for listing/management."""
    if user.role == User.Role.ADMIN:
        return User.objects.filter(is_active_user=True)
    if user.role == User.Role.MANAGER:
        descendants = get_descendant_ids(user)
        return User.objects.filter(Q(id=user.id) | Q(id__in=descendants))
    if user.role == User.Role.TL:
        descendants = get_descendant_ids(user)
        return User.objects.filter(Q(id=user.id) | Q(id__in=descendants))
    return User.objects.filter(id=user.id)


def leads_for_user(user):
    from .models import Lead

    if user.role == User.Role.ADMIN:
        return Lead.objects.all()
    if user.role == User.Role.MANAGER:
        descendants = get_descendant_ids(user)
        return Lead.objects.filter(Q(bdm=user) | Q(bdm_id__in=descendants))
    if user.role == User.Role.TL:
        team_ids = get_descendant_ids(user)
        return Lead.objects.filter(Q(bdm=user) | Q(bdm_id__in=team_ids))
    qs = Lead.objects.filter(bdm=user)
    if user.assigned_projects.exists():
        qs = qs.filter(project__in=user.assigned_projects.all())
    return qs


def teams_for_user(user):
    from .models import Team

    if user.role == User.Role.ADMIN:
        return Team.objects.all()
    if user.role == User.Role.MANAGER:
        return Team.objects.filter(manager=user)
    if user.role == User.Role.TL:
        return Team.objects.filter(Q(manager=user) | Q(members=user)).distinct()
    return Team.objects.none()


def can_manage_team(user):
    return user.role in (User.Role.ADMIN, User.Role.MANAGER, User.Role.TL)


def can_manage_user(actor, target):
    if actor.role == User.Role.ADMIN:
        return True
    if actor.role == User.Role.MANAGER:
        return target.id in get_descendant_ids(actor) or target.reports_to_id == actor.id
    return False


def can_assign_visits(user):
    return user.role in (User.Role.ADMIN, User.Role.MANAGER, User.Role.TL)


def can_reassign_leads(user):
    return user.role in (User.Role.ADMIN, User.Role.MANAGER, User.Role.TL)


from .utils import normalize_mobile


def find_duplicate_leads(user, project_id, mobile, *, exclude_lead_id=None):
    """Leads for the same normalized mobile within a project (visible to user)."""
    from .models import Lead

    norm = normalize_mobile(mobile)
    if not norm or not project_id:
        return []
    qs = leads_for_user(user).filter(project_id=project_id).select_related("merchant", "bdm", "product", "project")
    if exclude_lead_id:
        qs = qs.exclude(id=exclude_lead_id)
    return [lead for lead in qs if normalize_mobile(lead.merchant.mobile) == norm]


def can_reassign_to(actor, target):
    """Target must be an active BDM/TL in actor's visible hierarchy (Admin: any)."""
    if not target or not target.is_active_user:
        return False
    if target.role not in (User.Role.BDM, User.Role.TL, User.Role.MANAGER):
        return False
    if actor.role == User.Role.ADMIN:
        return True
    if target.id == actor.id:
        return True
    return target.id in get_descendant_ids(actor)


def user_can_access_project_form(user, project_id):
    from .models import Lead, Team

    if is_admin(user):
        return True
    if user.assigned_projects.filter(id=project_id).exists():
        return True
    if Team.objects.filter(project_id=project_id, members=user).exists():
        return True
    if user.role in (User.Role.MANAGER, User.Role.TL):
        return leads_for_user(user).filter(project_id=project_id).exists()
    return Lead.objects.filter(bdm=user, project_id=project_id).exists()


def visits_for_user(user):
    from .models import LeadVisit

    qs = LeadVisit.objects.select_related("lead", "assigned_to", "assigned_by", "lead__merchant")
    if user.role == User.Role.ADMIN:
        return qs
    if user.role == User.Role.BDM:
        return qs.filter(assigned_to=user)
    descendants = get_descendant_ids(user)
    return qs.filter(Q(assigned_to=user) | Q(assigned_to_id__in=descendants) | Q(assigned_by=user))


def my_assigned_visits(user):
    """Visits in the current user's personal workdesk queue."""
    from .models import LeadVisit

    return LeadVisit.objects.select_related(
        "lead", "assigned_to", "assigned_by", "lead__merchant"
    ).filter(assigned_to=user)


def validate_form_answers(schema, answers):
    import re

    errors = []
    file_ext_map = {
        "pdf": [".pdf"],
        "excel": [".xls", ".xlsx"],
        "word": [".doc", ".docx"],
        "image": [".jpg", ".jpeg", ".png", ".webp"],
        "csv": [".csv"],
        "document": [".pdf", ".doc", ".docx", ".xls", ".xlsx"],
    }

    for field in schema or []:
        fid = field.get("field_id")
        if not fid:
            continue
        val = answers.get(fid)
        ftype = field.get("type", "text")
        label = field.get("label", fid)

        if field.get("required"):
            empty = val is None or (isinstance(val, str) and not str(val).strip())
            if ftype == "multiselect":
                empty = not isinstance(val, list) or len(val) == 0
            if empty:
                errors.append(f"{label} is required")
                continue

        if val is None or val == "" or (isinstance(val, list) and not val):
            continue

        if ftype == "email" and isinstance(val, str):
            if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", val.strip()):
                errors.append(f"{label} must be a valid email address")

        if ftype == "url" and isinstance(val, str):
            if not re.match(r"^https?://", val.strip(), re.I):
                errors.append(f"{label} must be a valid URL (starting with http:// or https://)")

        if ftype == "number":
            try:
                num = float(val)
                if field.get("min") is not None and num < float(field["min"]):
                    errors.append(f"{label} must be at least {field['min']}")
                if field.get("max") is not None and num > float(field["max"]):
                    errors.append(f"{label} must be at most {field['max']}")
            except (TypeError, ValueError):
                errors.append(f"{label} must be a valid number")

        if ftype == "file" and isinstance(val, str) and val.strip():
            if val.startswith("http://") or val.startswith("https://"):
                continue
            accept_key = field.get("file_accept") or "any"
            allowed = file_ext_map.get(accept_key)
            if allowed:
                lower = val.lower()
                if not any(lower.endswith(ext) for ext in allowed):
                    errors.append(f"{label}: invalid file type for this field")

    return errors
