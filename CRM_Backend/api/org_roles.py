"""Organization-scoped roles: create / update + page permissions."""

from __future__ import annotations

from django.utils.text import slugify

from .models import OrganizationRole, OrganizationRolePagePermission
from .page_access import DEFAULT_ROLE_PAGES, FIELD_PAGE_CATALOG, FIELD_PAGE_KEYS, LOCKED_PAGE_KEYS

SYSTEM_ROLE_DEFS = [
    {"name": "Manager", "slug": "manager", "base_role": OrganizationRole.BaseRole.MANAGER, "description": "Team managers"},
    {"name": "Team Lead", "slug": "tl", "base_role": OrganizationRole.BaseRole.TL, "description": "Team leads"},
    {"name": "BDM", "slug": "bdm", "base_role": OrganizationRole.BaseRole.BDM, "description": "Field sales BDMs"},
    {"name": "Ops", "slug": "ops", "base_role": OrganizationRole.BaseRole.OPS, "description": "Office operations / verification"},
]


def _seed_role_pages(role: OrganizationRole, defaults: dict | None = None):
    defaults = defaults or DEFAULT_ROLE_PAGES.get(role.base_role, {})
    for page_key in FIELD_PAGE_KEYS:
        enabled = True if page_key in LOCKED_PAGE_KEYS else bool(defaults.get(page_key, False))
        OrganizationRolePagePermission.objects.get_or_create(
            role=role,
            page_key=page_key,
            defaults={"enabled": enabled},
        )


def ensure_org_roles(org):
    """Idempotently create system Manager/TL/BDM/Ops roles for a company."""
    if org is None:
        return []
    created = []
    for meta in SYSTEM_ROLE_DEFS:
        role, was = OrganizationRole.objects.get_or_create(
            organization=org,
            slug=meta["slug"],
            defaults={
                "name": meta["name"],
                "description": meta["description"],
                "base_role": meta["base_role"],
                "is_system": True,
                "is_active": True,
            },
        )
        if was:
            created.append(role)
        elif not role.is_system:
            role.is_system = True
            role.save(update_fields=["is_system"])
        _seed_role_pages(role)
    return created


def unique_role_slug(org, name: str, exclude_id=None) -> str:
    base = slugify(name)[:60] or "role"
    candidate = base
    n = 1
    qs = OrganizationRole.objects.filter(organization=org)
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    while qs.filter(slug=candidate).exists():
        n += 1
        candidate = f"{base}-{n}"
    return candidate


def role_pages_payload(role: OrganizationRole) -> list[dict]:
    lookup = {p.page_key: p.enabled for p in role.page_permissions.all()}
    defaults = DEFAULT_ROLE_PAGES.get(role.base_role, {})
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
                "enabled": True if meta.get("locked") else bool(lookup.get(key, defaults.get(key, False))),
            }
        )
    return pages


def serialize_org_role(role: OrganizationRole, *, include_pages=True) -> dict:
    data = {
        "id": role.id,
        "name": role.name,
        "slug": role.slug,
        "description": role.description or "",
        "base_role": role.base_role,
        "is_system": role.is_system,
        "is_active": role.is_active,
        "users_count": role.users.filter(is_active_user=True).count(),
        "created_at": role.created_at.isoformat() if role.created_at else None,
        "updated_at": role.updated_at.isoformat() if role.updated_at else None,
    }
    if include_pages:
        data["pages"] = role_pages_payload(role)
    return data


def set_role_pages(role: OrganizationRole, pages: list[dict] | None, enabled_map: dict | None = None):
    """Update page toggles from list of {page_key, enabled} or {page_key: bool} map."""
    if enabled_map is None:
        enabled_map = {}
        for item in pages or []:
            if not isinstance(item, dict):
                continue
            key = (item.get("page_key") or "").strip()
            if key:
                enabled_map[key] = bool(item.get("enabled"))
    for page_key in FIELD_PAGE_KEYS:
        enabled = True if page_key in LOCKED_PAGE_KEYS else bool(enabled_map.get(page_key, False))
        OrganizationRolePagePermission.objects.update_or_create(
            role=role,
            page_key=page_key,
            defaults={"enabled": enabled},
        )


def pages_for_org_role(role: OrganizationRole) -> list[str]:
    _seed_role_pages(role)
    keys = list(
        role.page_permissions.filter(enabled=True).values_list("page_key", flat=True)
    )
    if "profile" not in keys:
        keys.append("profile")
    return keys
