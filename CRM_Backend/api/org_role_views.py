"""Company Admin: create / update organization roles and their page access."""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .audit import log_audit
from .models import OrganizationRole
from .org_roles import (
    ensure_org_roles,
    serialize_org_role,
    set_role_pages,
    unique_role_slug,
)
from .page_access import FIELD_PAGE_CATALOG
from .permissions import is_company_admin


class OrganizationRoleViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def _org(self, request):
        if not is_company_admin(request.user):
            raise PermissionDenied("Only company Admin can manage roles.")
        org = getattr(request.user, "organization", None)
        if org is None:
            raise PermissionDenied("Your account is not linked to a company.")
        ensure_org_roles(org)
        return org

    def _get_role(self, org, pk):
        try:
            return OrganizationRole.objects.prefetch_related("page_permissions").get(
                id=pk, organization=org
            )
        except OrganizationRole.DoesNotExist:
            raise ValidationError({"detail": "Role not found."})

    def list(self, request):
        org = self._org(request)
        roles = (
            OrganizationRole.objects.filter(organization=org)
            .prefetch_related("page_permissions")
            .order_by("-is_system", "name")
        )
        return Response(
            {
                "results": [serialize_org_role(r) for r in roles],
                "page_catalog": FIELD_PAGE_CATALOG,
                "base_roles": [
                    {"value": c[0], "label": c[1]} for c in OrganizationRole.BaseRole.choices
                ],
            }
        )

    def retrieve(self, request, pk=None):
        org = self._org(request)
        role = self._get_role(org, pk)
        return Response(serialize_org_role(role))

    def create(self, request):
        org = self._org(request)
        name = (request.data.get("name") or "").strip()
        if not name:
            raise ValidationError({"detail": "Role name is required."})
        base_role = (request.data.get("base_role") or OrganizationRole.BaseRole.BDM).strip()
        valid_bases = {c[0] for c in OrganizationRole.BaseRole.choices}
        if base_role not in valid_bases:
            raise ValidationError({"detail": "Invalid base_role. Use Manager, TL, BDM, or Ops."})
        description = (request.data.get("description") or "").strip()
        slug = unique_role_slug(org, name)
        role = OrganizationRole.objects.create(
            organization=org,
            name=name[:80],
            slug=slug,
            description=description[:255],
            base_role=base_role,
            is_system=False,
            is_active=True,
        )
        pages = request.data.get("pages")
        if pages:
            set_role_pages(role, pages)
        else:
            from .org_roles import _seed_role_pages

            _seed_role_pages(role)
        log_audit(
            request.user,
            action="role.created",
            entity_type="OrganizationRole",
            entity_id=role.id,
            message=f"Created role {role.name} (base={role.base_role})",
        )
        return Response(serialize_org_role(role), status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        org = self._org(request)
        role = self._get_role(org, pk)
        name = request.data.get("name")
        if name is not None:
            name = str(name).strip()
            if not name:
                raise ValidationError({"detail": "Role name cannot be empty."})
            if not role.is_system:
                role.name = name[:80]
                role.slug = unique_role_slug(org, name, exclude_id=role.id)
        if "description" in request.data:
            role.description = str(request.data.get("description") or "")[:255]
        if "is_active" in request.data and not role.is_system:
            role.is_active = bool(request.data.get("is_active"))
        if "base_role" in request.data:
            base_role = str(request.data.get("base_role") or "").strip()
            valid_bases = {c[0] for c in OrganizationRole.BaseRole.choices}
            if base_role not in valid_bases:
                raise ValidationError({"detail": "Invalid base_role."})
            # System roles keep fixed base matching their template
            if not role.is_system:
                role.base_role = base_role
        role.save()
        if "pages" in request.data:
            set_role_pages(role, request.data.get("pages") or [])
        log_audit(
            request.user,
            action="role.updated",
            entity_type="OrganizationRole",
            entity_id=role.id,
            message=f"Updated role {role.name}",
        )
        role.refresh_from_db()
        return Response(serialize_org_role(role))

    def destroy(self, request, pk=None):
        org = self._org(request)
        role = self._get_role(org, pk)
        if role.is_system:
            raise PermissionDenied("System roles (Manager / TL / BDM / Ops) cannot be deleted.")
        if role.users.filter(is_active_user=True).exists():
            raise ValidationError(
                {"detail": "Reassign users from this role before deleting it."}
            )
        rid, name = role.id, role.name
        role.delete()
        log_audit(
            request.user,
            action="role.deleted",
            entity_type="OrganizationRole",
            entity_id=rid,
            message=f"Deleted role {name}",
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["put"], url_path="permissions")
    def permissions(self, request, pk=None):
        org = self._org(request)
        role = self._get_role(org, pk)
        pages = request.data.get("pages") or request.data.get("permissions") or []
        set_role_pages(role, pages)
        log_audit(
            request.user,
            action="role.permissions_updated",
            entity_type="OrganizationRole",
            entity_id=role.id,
            message=f"Updated page permissions for {role.name}",
        )
        return Response(serialize_org_role(role))
