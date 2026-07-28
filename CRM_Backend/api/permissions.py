from collections import deque

from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()


def is_superadmin(user):
    return getattr(user, "role", None) == User.Role.SUPERADMIN


def is_admin(user):
    return user.role in (User.Role.ADMIN, User.Role.SUPERADMIN)


def is_company_admin(user):
    return user.role == User.Role.ADMIN


def is_ops(user):
    return user.role == User.Role.OPS


def is_manager(user):
    return user.role == User.Role.MANAGER


def is_manager_or_admin(user):
    return user.role in (User.Role.ADMIN, User.Role.SUPERADMIN, User.Role.MANAGER, User.Role.TL)


def can_assign_verification(user):
    return user.role in (User.Role.ADMIN, User.Role.SUPERADMIN, User.Role.MANAGER, User.Role.TL)


def can_edit_lead_data(user, lead=None):
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if is_superadmin(user) or is_company_admin(user):
        return True
    if not getattr(user, "can_edit_leads", True):
        return False
    if user.role in (User.Role.MANAGER, User.Role.TL, User.Role.BDM, User.Role.OPS):
        return True
    return False


def verification_works_for_user(user):
    from django.db.models import Q

    from .models import VerificationWork

    qs = VerificationWork.objects.select_related(
        "lead",
        "lead__merchant",
        "lead__project",
        "assigned_to",
        "assigned_by",
        "document",
        "form_submission",
    )
    if is_superadmin(user):
        return qs
    if is_company_admin(user):
        if user.organization_id:
            return qs.filter(organization_id=user.organization_id)
        return qs.filter(lead__project_id__in=project_ids_for_user(user))
    if user.role in (User.Role.MANAGER, User.Role.TL):
        ids = get_descendant_ids(user)
        ids.add(user.id)
        pids = project_ids_for_user(user)
        return qs.filter(
            Q(assigned_to_id__in=ids)
            | Q(assigned_by=user)
            | Q(lead__bdm_id__in=ids)
            | Q(status__in=["open", "reopened"], lead__project_id__in=pids)
        ).distinct()
    # Ops (and BDM if assigned) — only own queue
    return qs.filter(assigned_to=user)


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


def _direct_project_ids(user):
    """Projects explicitly assigned to a user or via team membership/management."""
    from .models import Team

    ids = set(user.assigned_projects.values_list("id", flat=True))
    ids.update(
        Team.objects.filter(Q(manager=user) | Q(members=user))
        .exclude(project_id=None)
        .values_list("project_id", flat=True)
    )
    return {i for i in ids if i}


def project_ids_for_user(user):
    """
    Effective project scope for hierarchy ACL.

    Admin → None (unrestricted).
    Others → own assigned/team projects ∪ ancestors' (Manager/TL) assigned/team projects.
    Empty set means no project access (no cross-project leakage).
    """
    if not user or not getattr(user, "is_authenticated", False):
        return set()
    if is_admin(user):
        return None

    ids = set(_direct_project_ids(user))

    # Inherit from reporting chain so Manager's project access flows to TL/BDM team
    ancestor = getattr(user, "reports_to", None)
    seen = {user.id}
    while ancestor and ancestor.id not in seen:
        seen.add(ancestor.id)
        if ancestor.role in (User.Role.MANAGER, User.Role.TL, User.Role.ADMIN, User.Role.SUPERADMIN):
            ids |= _direct_project_ids(ancestor)
        ancestor = getattr(ancestor, "reports_to", None)

    return ids


def projects_for_user(user):
    """Project queryset visible to the user."""
    from .models import Project

    if is_admin(user):
        return Project.objects.all()
    ids = project_ids_for_user(user)
    if not ids:
        return Project.objects.none()
    return Project.objects.filter(id__in=ids)


def user_can_access_project(user, project_id):
    if not project_id:
        return False
    if is_admin(user):
        return True
    ids = project_ids_for_user(user)
    return int(project_id) in ids


def users_for_user(user):
    """Users visible in hierarchy for listing/management."""
    if is_admin(user):
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

    if is_admin(user):
        return Lead.objects.all()

    if user.role == User.Role.MANAGER:
        descendants = get_descendant_ids(user)
        qs = Lead.objects.filter(Q(bdm=user) | Q(bdm_id__in=descendants))
    elif user.role == User.Role.TL:
        team_ids = get_descendant_ids(user)
        qs = Lead.objects.filter(Q(bdm=user) | Q(bdm_id__in=team_ids))
    else:
        qs = Lead.objects.filter(bdm=user)

    # Hierarchy project clamp — team only sees manager-assigned projects
    project_ids = project_ids_for_user(user)
    if project_ids is not None:
        if not project_ids:
            return Lead.objects.none()
        qs = qs.filter(project_id__in=project_ids)
    return qs


def teams_for_user(user):
    from .models import Team

    if is_admin(user):
        return Team.objects.all()
    if user.role == User.Role.MANAGER:
        return Team.objects.filter(manager=user)
    if user.role == User.Role.TL:
        return Team.objects.filter(Q(manager=user) | Q(members=user)).distinct()
    return Team.objects.none()


def can_manage_team(user):
    return user.role in (User.Role.ADMIN, User.Role.MANAGER, User.Role.TL)


def can_manage_user(actor, target):
    if is_admin(actor):
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
    if not user_can_access_project(user, project_id):
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
    if is_admin(actor):
        return True
    if target.id == actor.id:
        return True
    return target.id in get_descendant_ids(actor)


def user_can_access_project_form(user, project_id):
    return user_can_access_project(user, project_id)


def visits_for_user(user):
    from .models import LeadVisit

    qs = LeadVisit.objects.select_related("lead", "assigned_to", "assigned_by", "lead__merchant")
    if is_admin(user):
        return qs
    if user.role == User.Role.BDM:
        qs = qs.filter(assigned_to=user)
    else:
        descendants = get_descendant_ids(user)
        qs = qs.filter(Q(assigned_to=user) | Q(assigned_to_id__in=descendants) | Q(assigned_by=user))

    project_ids = project_ids_for_user(user)
    if project_ids is not None:
        if not project_ids:
            return LeadVisit.objects.none()
        qs = qs.filter(lead__project_id__in=project_ids)
    return qs


def my_assigned_visits(user):
    """Visits in the current user's personal workdesk queue."""
    from .models import LeadVisit

    qs = LeadVisit.objects.select_related(
        "lead", "assigned_to", "assigned_by", "lead__merchant"
    ).filter(assigned_to=user)
    project_ids = project_ids_for_user(user)
    if project_ids is not None:
        if not project_ids:
            return LeadVisit.objects.none()
        qs = qs.filter(lead__project_id__in=project_ids)
    return qs


def effective_form_schema(form_or_schema, enable_collection=None):
    """
    Return schema used for fill/validation.
    Collection (Amount Collected) fields stay hidden until enable_collection is on.
    """
    if hasattr(form_or_schema, "schema"):
        schema = list(form_or_schema.schema or [])
        if enable_collection is None:
            enable_collection = bool(getattr(form_or_schema, "enable_collection", False))
    else:
        schema = list(form_or_schema or [])
        if enable_collection is None:
            enable_collection = False
    if enable_collection:
        return schema
    return [f for f in schema if f.get("metric_role") != "collection"]


def validate_single_file_field(field_def, filename):
    """Validate one file upload without requiring other form answers."""
    file_ext_map = {
        "pdf": [".pdf"],
        "excel": [".xls", ".xlsx"],
        "word": [".doc", ".docx"],
        "image": [".jpg", ".jpeg", ".png", ".webp"],
        "csv": [".csv"],
        "document": [".pdf", ".doc", ".docx", ".xls", ".xlsx"],
    }
    if not field_def or field_def.get("type") != "file":
        return ["Invalid file field."]
    accept_key = field_def.get("file_accept") or "any"
    allowed = file_ext_map.get(accept_key)
    if allowed and filename:
        lower = str(filename).lower()
        if not any(lower.endswith(ext) for ext in allowed):
            label = field_def.get("label") or "File"
            return [f"{label}: invalid file type for this field"]
    return []


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

    def selected_options(field):
        fid = field.get("field_id")
        raw = answers.get(fid)
        if field.get("type") == "multiselect":
            return [str(x) for x in raw] if isinstance(raw, list) else []
        if raw is None or raw == "":
            return []
        return [str(raw)]

    # Fields only shown when an option rule reveals them
    conditional_ids = set()
    revealed_ids = set()
    for field in schema or []:
        for rule in field.get("option_rules") or []:
            for sid in rule.get("show_field_ids") or []:
                conditional_ids.add(sid)
        if not field.get("option_rules"):
            continue
        selected = selected_options(field)
        for rule in field.get("option_rules") or []:
            if rule.get("option") in selected:
                for sid in rule.get("show_field_ids") or []:
                    revealed_ids.add(sid)

    # Early-end flow: skip required checks on later step panels
    end_early = False
    for field in schema or []:
        for rule in field.get("option_rules") or []:
            if rule.get("option") in selected_options(field) and rule.get("flow") == "end":
                end_early = True
                break
        if end_early:
            break

    # If next_step is also selected, it wins over end
    if end_early:
        for field in schema or []:
            for rule in field.get("option_rules") or []:
                if rule.get("option") in selected_options(field) and rule.get("flow") == "next_step":
                    end_early = False
                    break

    past_break_after_end = False
    for field in schema or []:
        fid = field.get("field_id")
        if not fid:
            continue
        ftype = field.get("type", "text")
        if ftype == "step_break":
            if end_early:
                past_break_after_end = True
            continue
        if past_break_after_end:
            continue
        if fid in conditional_ids and fid not in revealed_ids:
            continue

        val = answers.get(fid)
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

        if ftype in ("number", "currency"):
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


ROLE_LABELS = {
    "collection": "Amount Collected",
    "pending_amount": "Collection Pending",
    "deal_value": "Deal Value",
}


def discover_money_fields(project_ids=None):
    """Map field_id -> {role, label, currency} from project form schemas."""
    from .models import CustomForm

    qs = CustomForm.objects.all()
    if project_ids is not None:
        ids = [int(x) for x in project_ids if x is not None and str(x).strip() != ""]
        qs = qs.filter(project_id__in=ids or [-1])

    mapping = {}
    for form in qs.only("schema"):
        schema = form.schema or []
        if isinstance(schema, str):
            continue
        if not isinstance(schema, list):
            continue
        for field in schema:
            if not isinstance(field, dict):
                continue
            fid = field.get("field_id")
            role = field.get("metric_role")
            ftype = field.get("type", "text")
            if not fid or not role or ftype not in ("currency", "number"):
                continue
            mapping[fid] = {
                "role": role,
                "label": field.get("label") or ROLE_LABELS.get(role, role),
                "currency": field.get("currency") or "INR",
            }
    return mapping


def aggregate_money_metrics(leads_qs, project_ids=None):
    """Sum tagged amount fields from lead.custom_data for dashboard KPIs."""
    empty = {
        "has_money": False,
        "metrics": [],
        "total_collection": 0,
        "total_pending": 0,
        "total_deal_value": 0,
    }
    try:
        mapping = discover_money_fields(project_ids)
        if not mapping:
            return empty

        totals = {}
        labels = {}
        currencies = {}
        for meta in mapping.values():
            role = meta["role"]
            totals.setdefault(role, 0.0)
            labels.setdefault(role, meta["label"])
            currencies.setdefault(role, meta["currency"])

        # Use values() — avoids FieldError when leads_qs already has select_related()
        for row in leads_qs.values("custom_data").iterator(chunk_size=500):
            data = row.get("custom_data") or {}
            if not isinstance(data, dict):
                continue
            for fid, meta in mapping.items():
                raw = data.get(fid)
                if raw is None or raw == "":
                    continue
                try:
                    totals[meta["role"]] += float(raw)
                except (TypeError, ValueError):
                    continue

        metrics = [
            {
                "role": role,
                "label": labels.get(role, ROLE_LABELS.get(role, role)),
                "total": round(total, 2),
                "currency": currencies.get(role, "INR"),
            }
            for role, total in totals.items()
        ]
        metrics.sort(key=lambda m: {"pending_amount": 0, "collection": 1, "deal_value": 2}.get(m["role"], 9))

        return {
            "has_money": True,
            "metrics": metrics,
            "total_collection": round(totals.get("collection", 0), 2),
            "total_pending": round(totals.get("pending_amount", 0), 2),
            "total_deal_value": round(totals.get("deal_value", 0), 2),
        }
    except Exception:
        # Never take down dashboard / admin console for money rollups
        return empty


def user_has_crm_pro_mobile_access(user) -> bool:
    """Trackbook mobile CRM Pro — user must be active and enabled on user or project."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if not getattr(user, "is_active_user", True) or not user.is_active:
        return False
    if is_admin(user):
        return True
    explicit = getattr(user, "crm_pro_mobile_enabled", None)
    if explicit is False:
        return False
    if explicit is True:
        return True
    from .models import Project

    pids = project_ids_for_user(user)
    if pids is None:
        return Project.objects.filter(is_active=True, crm_pro_mobile_enabled=True).exists()
    if not pids:
        return False
    return Project.objects.filter(id__in=pids, crm_pro_mobile_enabled=True).exists()
