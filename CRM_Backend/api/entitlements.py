"""Company module entitlements controlled by Super Admin packages / overrides."""

from __future__ import annotations

from copy import deepcopy

# Modules Super Admin can enable per company / package.
# profile is always forced on for company users.
MODULE_CATALOG = [
    {"key": "admin", "label": "Org Dashboard", "group": "Admin", "default": True},
    {"key": "admin.projects", "label": "Projects", "group": "Admin", "default": True},
    {"key": "admin.users", "label": "Users", "group": "Admin", "default": True},
    {"key": "admin.forms", "label": "Form Builder", "group": "Admin", "default": True},
    {"key": "admin.permissions", "label": "Role Permissions", "group": "Admin", "default": False},
    {"key": "admin.audit", "label": "Audit Log", "group": "Admin", "default": False},
    {"key": "dashboard", "label": "Workdesk / Dashboard", "group": "Field", "default": True},
    {"key": "leads", "label": "Leads", "group": "Field", "default": True},
    {"key": "pipeline", "label": "Pipeline", "group": "Field", "default": False},
    {"key": "follow-ups", "label": "Follow-ups", "group": "Field", "default": True},
    {"key": "visits", "label": "Visits", "group": "Field", "default": True},
    {"key": "verification", "label": "Verification", "group": "Field", "default": True},
    {"key": "duplicates", "label": "Duplicates", "group": "Field", "default": False},
    {"key": "alerts", "label": "Alerts", "group": "Field", "default": True},
    {"key": "reports", "label": "Reports", "group": "Field", "default": True},
    {"key": "targets", "label": "Targets", "group": "Field", "default": False},
    {"key": "team", "label": "Teams", "group": "Field", "default": True},
    {"key": "profile", "label": "Profile", "group": "Core", "default": True, "locked": True},
]

ALL_MODULE_KEYS = [m["key"] for m in MODULE_CATALOG]
LOCKED_MODULES = {m["key"] for m in MODULE_CATALOG if m.get("locked")}
DEFAULT_COMMON_MODULES = [m["key"] for m in MODULE_CATALOG if m.get("default")]


def sanitize_modules(keys) -> list[str]:
    if not keys:
        keys = DEFAULT_COMMON_MODULES
    out = []
    seen = set()
    for k in keys:
        key = str(k or "").strip()
        if key in ALL_MODULE_KEYS and key not in seen:
            out.append(key)
            seen.add(key)
    if "profile" not in seen:
        out.append("profile")
    return out


def default_common_modules() -> list[str]:
    return list(DEFAULT_COMMON_MODULES)


def module_catalog_payload():
    return deepcopy(MODULE_CATALOG)


def ensure_default_packages():
    """Seed Starter / Growth / Enterprise packages if missing."""
    from decimal import Decimal

    from .models import SubscriptionPackage

    presets = [
        {
            "name": "Starter",
            "slug": "starter",
            "description": "Most common CRM modules for new companies (default trial package).",
            "price": Decimal("4999.00"),
            "trial_days": 15,
            "module_keys": default_common_modules(),
            "is_default": True,
            "sort_order": 1,
        },
        {
            "name": "Growth",
            "slug": "growth",
            "description": "Starter plus pipeline, targets, and role permissions.",
            "price": Decimal("9999.00"),
            "trial_days": 15,
            "module_keys": sanitize_modules(
                default_common_modules()
                + ["pipeline", "targets", "admin.permissions", "duplicates"]
            ),
            "is_default": False,
            "sort_order": 2,
        },
        {
            "name": "Enterprise",
            "slug": "enterprise",
            "description": "All modules unlocked.",
            "price": Decimal("19999.00"),
            "trial_days": 15,
            "module_keys": list(ALL_MODULE_KEYS),
            "is_default": False,
            "sort_order": 3,
        },
    ]
    created = 0
    for p in presets:
        obj, was = SubscriptionPackage.objects.get_or_create(
            slug=p["slug"],
            defaults=p,
        )
        if was:
            created += 1
        elif p["slug"] == "starter" and not obj.is_default:
            SubscriptionPackage.objects.filter(is_default=True).exclude(id=obj.id).update(is_default=False)
            obj.is_default = True
            obj.save(update_fields=["is_default"])
    return created


def get_default_package():
    from .models import SubscriptionPackage

    ensure_default_packages()
    pkg = SubscriptionPackage.objects.filter(is_active=True, is_default=True).first()
    if pkg:
        return pkg
    return SubscriptionPackage.objects.filter(is_active=True).order_by("sort_order", "id").first()


def apply_package_to_org(org, package=None, *, keep_custom=False):
    """Assign package and sync enabled_modules (unless keep_custom)."""
    from django.utils import timezone

    if package is None:
        package = get_default_package()
    if package is None:
        org.enabled_modules = sanitize_modules(org.enabled_modules or default_common_modules())
        if not org.plan_label:
            org.plan_label = "Trial"
        return org

    org.package = package
    org.plan_label = package.name
    if not keep_custom:
        org.enabled_modules = sanitize_modules(package.module_keys or default_common_modules())
    org.package_assigned_at = timezone.now()
    return org


def ensure_org_entitlements(org):
    """Guarantee org has modules (and default package link when empty)."""
    if org is None:
        return None
    changed = False
    modules = sanitize_modules(org.enabled_modules or [])
    if not org.enabled_modules:
        pkg = org.package or get_default_package()
        if pkg and not org.package_id:
            org.package = pkg
            changed = True
        modules = sanitize_modules((pkg.module_keys if pkg else None) or default_common_modules())
    # Company Admin must always manage Roles
    if "admin.permissions" not in modules:
        modules.append("admin.permissions")
    if "profile" not in modules:
        modules.append("profile")
    modules = sanitize_modules(modules)
    if modules != list(org.enabled_modules or []):
        org.enabled_modules = modules
        changed = True
    if changed:
        fields = ["enabled_modules"]
        if org.package_id:
            fields.append("package")
        org.save(update_fields=fields)
    return org


def org_enabled_modules(org) -> list[str]:
    if org is None:
        return default_common_modules()
    ensure_org_entitlements(org)
    return sanitize_modules(org.enabled_modules or default_common_modules())
