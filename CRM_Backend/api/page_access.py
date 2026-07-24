"""Role-based CRM page access catalog and helpers."""

from django.contrib.auth import get_user_model

User = get_user_model()

# Field pages Admin can toggle for Manager / TL / BDM
FIELD_PAGE_CATALOG = [
    {"page_key": "dashboard", "label": "Dashboard / Workdesk", "href": "/dashboard", "description": "Role home with KPIs and forms"},
    {"page_key": "leads", "label": "Leads", "href": "/leads", "description": "Lead list and merchant records"},
    {"page_key": "pipeline", "label": "Pipeline", "href": "/pipeline", "description": "Kanban pipeline board"},
    {"page_key": "duplicates", "label": "Duplicates", "href": "/duplicates", "description": "Duplicate lead review"},
    {"page_key": "follow-ups", "label": "Follow-ups", "href": "/follow-ups", "description": "Follow-up hub"},
    {"page_key": "alerts", "label": "Alerts", "href": "/alerts", "description": "Ops and document alerts"},
    {"page_key": "reports", "label": "Reports", "href": "/reports", "description": "Performance reports"},
    {"page_key": "targets", "label": "Targets", "href": "/targets", "description": "Sales targets"},
    {"page_key": "visits", "label": "Visits", "href": "/visits", "description": "Visit calendar"},
    {"page_key": "team", "label": "Teams", "href": "/team", "description": "Team roster and reporting"},
    {"page_key": "profile", "label": "Profile", "href": "/profile", "description": "Own profile (always on)", "locked": True},
]

FIELD_PAGE_KEYS = [p["page_key"] for p in FIELD_PAGE_CATALOG]
LOCKED_PAGE_KEYS = {p["page_key"] for p in FIELD_PAGE_CATALOG if p.get("locked")}

# Matches current NAV defaults
DEFAULT_ROLE_PAGES = {
    User.Role.MANAGER: {k: True for k in FIELD_PAGE_KEYS},
    User.Role.TL: {k: True for k in FIELD_PAGE_KEYS},
    User.Role.BDM: {
        "dashboard": True,
        "leads": True,
        "pipeline": True,
        "duplicates": False,
        "follow-ups": True,
        "alerts": True,
        "reports": True,
        "targets": True,
        "visits": True,
        "team": False,
        "profile": True,
    },
}

ADMIN_PAGE_KEYS = [
    "admin",
    "admin.projects",
    "admin.users",
    "admin.forms",
    "admin.audit",
    "admin.permissions",
    "team",
    "reports",
    "profile",
]


def ensure_default_page_permissions():
    from .models import RolePagePermission

    created = 0
    for role, pages in DEFAULT_ROLE_PAGES.items():
        for page_key, enabled in pages.items():
            _, was_created = RolePagePermission.objects.get_or_create(
                role=role,
                page_key=page_key,
                defaults={"enabled": enabled},
            )
            if was_created:
                created += 1
    return created


def allowed_pages_for_user(user):
    if not user or not getattr(user, "is_authenticated", False):
        return []
    if user.role == User.Role.ADMIN:
        return list(ADMIN_PAGE_KEYS)

    ensure_default_page_permissions()
    from .models import RolePagePermission

    enabled = list(
        RolePagePermission.objects.filter(role=user.role, enabled=True).values_list("page_key", flat=True)
    )
    if "profile" not in enabled:
        enabled.append("profile")
    return enabled


def user_can_access_page(user, page_key: str) -> bool:
    if not page_key:
        return False
    if user.role == User.Role.ADMIN:
        return page_key in ADMIN_PAGE_KEYS or page_key in FIELD_PAGE_KEYS
    return page_key in allowed_pages_for_user(user)


def page_permissions_matrix():
    """Admin UI payload: one row per page with Manager/TL/BDM toggles."""
    ensure_default_page_permissions()
    from .models import RolePagePermission

    rows = RolePagePermission.objects.filter(role__in=[User.Role.MANAGER, User.Role.TL, User.Role.BDM])
    lookup = {(r.page_key, r.role): r.enabled for r in rows}

    pages = []
    for meta in FIELD_PAGE_CATALOG:
        key = meta["page_key"]
        pages.append(
            {
                "page_key": key,
                "label": meta["label"],
                "href": meta["href"],
                "description": meta.get("description", ""),
                "locked": bool(meta.get("locked")),
                "roles": {
                    User.Role.MANAGER: lookup.get((key, User.Role.MANAGER), DEFAULT_ROLE_PAGES[User.Role.MANAGER].get(key, True)),
                    User.Role.TL: lookup.get((key, User.Role.TL), DEFAULT_ROLE_PAGES[User.Role.TL].get(key, True)),
                    User.Role.BDM: lookup.get((key, User.Role.BDM), DEFAULT_ROLE_PAGES[User.Role.BDM].get(key, False)),
                },
            }
        )
    return {"pages": pages}
