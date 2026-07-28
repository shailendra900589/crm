"""Organization registration, Super Admin controls, HRMS sync, verification work queue."""

from datetime import timedelta

import requests
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Lead, LeadDocument, Notification, Organization, Project, VerificationWork
from .permissions import (
    can_assign_verification,
    can_edit_lead_data,
    get_descendant_ids,
    is_admin,
    is_company_admin,
    is_superadmin,
    project_ids_for_user,
    users_for_user,
    verification_works_for_user,
)
from .serializers import (
    OrganizationSerializer,
    OrganizationWriteSerializer,
    VerificationWorkSerializer,
)

User = get_user_model()


def _unique_slug(base: str) -> str:
    slug = slugify(base)[:40] or "company"
    candidate = slug
    n = 1
    while Organization.objects.filter(slug=candidate).exists():
        n += 1
        candidate = f"{slug}-{n}"
    return candidate


class RegisterOrganizationView(APIView):
    """Public company registration → pending Super Admin approval / trial."""

    permission_classes = [AllowAny]

    def post(self, request):
        name = (request.data.get("company_name") or request.data.get("name") or "").strip()
        email = (request.data.get("email") or "").strip().lower()
        phone = (request.data.get("phone") or "").strip()
        city = (request.data.get("city") or "").strip()
        admin_name = (request.data.get("admin_name") or "").strip()
        admin_username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        want_trial = bool(request.data.get("trial", True))

        if not name or not email or not admin_username or len(password) < 6:
            return Response(
                {"detail": "company_name, email, username and password (min 6) are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(username=admin_username).exists():
            return Response({"detail": "Username already taken."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email=email).exists():
            return Response({"detail": "Email already registered."}, status=status.HTTP_400_BAD_REQUEST)

        org = Organization.objects.create(
            name=name,
            slug=_unique_slug(name),
            email=email,
            phone=phone,
            city=city,
            admin_name=admin_name or admin_username,
            status=Organization.Status.PENDING,
            plan_label="Trial" if want_trial else "Paid pending",
            trial_ends_at=timezone.now() + timedelta(days=14) if want_trial else None,
        )
        admin = User.objects.create_user(
            username=admin_username,
            email=email,
            password=password,
            first_name=(admin_name or admin_username).split(" ")[0][:30],
            role=User.Role.ADMIN,
            organization=org,
            mobile_number=phone,
            is_active_user=False,  # until Super Admin approves
        )
        # Notify Super Admins
        for sa in User.objects.filter(role=User.Role.SUPERADMIN, is_active_user=True)[:10]:
            Notification.objects.create(
                user=sa,
                message=f"New company registration: {org.name} — approve / trial / payment",
                link="/admin/organizations",
            )
        return Response(
            {
                "detail": "Registration received. Super Admin will approve and enable trial or payment.",
                "organization": OrganizationSerializer(org).data,
                "admin_user_id": admin.id,
            },
            status=status.HTTP_201_CREATED,
        )


class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return OrganizationWriteSerializer
        return OrganizationSerializer

    def get_queryset(self):
        user = self.request.user
        # Platform company list / manage is Super Admin only.
        # Company Admin may still retrieve/sync their own org (HRMS).
        if is_superadmin(user):
            return Organization.objects.all()
        if is_company_admin(user) and user.organization_id and self.action in (
            "retrieve",
            "sync_hrms_employees",
            "partial_update",
            "update",
        ):
            return Organization.objects.filter(id=user.organization_id)
        return Organization.objects.none()

    def create(self, request, *args, **kwargs):
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin can create organizations here.")
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def platform_summary(self, request):
        """Super Admin KPI snapshot across all tenants."""
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        qs = Organization.objects.all()
        by_status = {
            row["status"]: row["c"]
            for row in qs.values("status").annotate(c=Count("id"))
        }
        users_total = User.objects.filter(organization__isnull=False, is_active_user=True).count()
        projects_total = Project.objects.filter(is_active=True).count()
        pending_regs = qs.filter(status=Organization.Status.PENDING).count()
        return Response(
            {
                "companies_total": qs.count(),
                "by_status": {
                    "pending": by_status.get(Organization.Status.PENDING, 0),
                    "trial": by_status.get(Organization.Status.TRIAL, 0),
                    "active": by_status.get(Organization.Status.ACTIVE, 0),
                    "suspended": by_status.get(Organization.Status.SUSPENDED, 0),
                    "rejected": by_status.get(Organization.Status.REJECTED, 0),
                },
                "users_total": users_total,
                "projects_total": projects_total,
                "pending_registrations": pending_regs,
                "access_allowed": qs.filter(
                    status__in=[Organization.Status.TRIAL, Organization.Status.ACTIVE]
                ).count(),
            }
        )

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        org = self.get_object()
        reason = (request.data.get("reason") or request.data.get("payment_notes") or "").strip()
        org.status = Organization.Status.SUSPENDED
        if reason:
            org.payment_notes = reason
        org.is_public = False
        org.save(update_fields=["status", "payment_notes", "is_public"])
        User.objects.filter(organization=org, role=User.Role.ADMIN).update(is_active_user=False)
        return Response(OrganizationSerializer(org).data)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        org = self.get_object()
        mode = (request.data.get("mode") or "active").lower()
        if mode == "trial":
            days = int(request.data.get("trial_days") or 14)
            org.status = Organization.Status.TRIAL
            org.plan_label = (request.data.get("plan_label") or org.plan_label or "Trial").strip()
            org.trial_ends_at = timezone.now() + timedelta(days=max(1, days))
        else:
            org.status = Organization.Status.ACTIVE
            org.plan_label = (request.data.get("plan_label") or org.plan_label or "Paid").strip()
            org.trial_ends_at = None
        if "payment_notes" in request.data:
            org.payment_notes = request.data.get("payment_notes") or ""
        org.is_public = bool(request.data.get("is_public", True))
        org.approved_by = request.user
        org.approved_at = timezone.now()
        org.save()
        User.objects.filter(organization=org, role=User.Role.ADMIN).update(is_active_user=True, is_active=True)
        return Response(OrganizationSerializer(org).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        org = self.get_object()
        mode = (request.data.get("mode") or "trial").lower()  # trial | active
        days = int(request.data.get("trial_days") or 14)
        plan = (request.data.get("plan_label") or "").strip()
        payment_notes = (request.data.get("payment_notes") or "").strip()
        publish = bool(request.data.get("is_public", True))

        if mode == "active":
            org.status = Organization.Status.ACTIVE
            org.plan_label = plan or "Paid"
            org.trial_ends_at = None
        else:
            org.status = Organization.Status.TRIAL
            org.plan_label = plan or "Trial"
            org.trial_ends_at = timezone.now() + timedelta(days=max(1, days))
        if payment_notes:
            org.payment_notes = payment_notes
        org.is_public = publish
        org.approved_by = request.user
        org.approved_at = timezone.now()
        org.save()

        # Activate company admins
        User.objects.filter(organization=org, role=User.Role.ADMIN).update(is_active_user=True, is_active=True)
        for admin in User.objects.filter(organization=org, role=User.Role.ADMIN):
            Notification.objects.create(
                user=admin,
                message=f"Company {org.name} approved ({org.get_status_display()}). You can add employees now.",
                link="/admin/users",
            )
        return Response(OrganizationSerializer(org).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        org = self.get_object()
        org.status = Organization.Status.REJECTED
        org.payment_notes = (request.data.get("reason") or org.payment_notes or "Rejected").strip()
        org.save(update_fields=["status", "payment_notes"])
        return Response(OrganizationSerializer(org).data)

    @action(detail=True, methods=["post"])
    def set_payment(self, request, pk=None):
        """Super Admin decides payment / plan / trial extension in one click."""
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        org = self.get_object()
        status_val = (request.data.get("status") or "").strip()
        if status_val in dict(Organization.Status.choices):
            org.status = status_val
        if "plan_label" in request.data:
            org.plan_label = request.data.get("plan_label") or org.plan_label
        if "payment_notes" in request.data:
            org.payment_notes = request.data.get("payment_notes") or ""
        if "trial_days" in request.data:
            org.trial_ends_at = timezone.now() + timedelta(days=int(request.data["trial_days"]))
        if "is_public" in request.data:
            org.is_public = bool(request.data.get("is_public"))
        if "hrms_connected" in request.data:
            org.hrms_connected = bool(request.data.get("hrms_connected"))
        if "hrms_company_id" in request.data:
            org.hrms_company_id = str(request.data.get("hrms_company_id") or "")
        if "hrms_api_base_url" in request.data:
            org.hrms_api_base_url = str(request.data.get("hrms_api_base_url") or org.hrms_api_base_url)
        org.save()
        return Response(OrganizationSerializer(org).data)

    @action(detail=True, methods=["post"], url_path="sync-hrms-employees")
    def sync_hrms_employees(self, request, pk=None):
        """
        Fetch employees from HRMS for this company and upsert as CRM users.
        Requires: org.hrms_connected + hrms_company_id + hrms_token (or stored admin credentials in body).
        """
        user = request.user
        org = self.get_object()
        if not (is_superadmin(user) or (is_company_admin(user) and user.organization_id == org.id)):
            raise PermissionDenied("Not allowed.")
        if not org.hrms_connected and not request.data.get("force"):
            return Response(
                {"detail": "Connect HRMS first (set hrms_connected + company id), or pass force=1."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token = (request.data.get("hrms_token") or "").strip()
        base = (org.hrms_api_base_url or "https://hrms.trackbook.co").rstrip("/")
        if not token:
            return Response(
                {"detail": "hrms_token required (HRMS JWT for a company admin)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            res = requests.get(
                f"{base}/api/users/company/employees/",
                params={"active_only": "1"},
                headers={"Authorization": f"Bearer {token}"},
                timeout=30,
            )
        except requests.RequestException as exc:
            return Response({"detail": f"HRMS unreachable: {exc}"}, status=status.HTTP_502_BAD_GATEWAY)

        if res.status_code >= 400:
            return Response(
                {"detail": f"HRMS error {res.status_code}", "body": res.text[:500]},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payload = res.json()
        rows = payload if isinstance(payload, list) else payload.get("results") or payload.get("employees") or []
        created = updated = 0
        errors = []
        role_map = {
            "admin": User.Role.ADMIN,
            "manager": User.Role.MANAGER,
            "tl": User.Role.TL,
            "team lead": User.Role.TL,
            "bdm": User.Role.BDM,
            "ops": User.Role.OPS,
            "office": User.Role.OPS,
            "employee": User.Role.OPS,
        }

        for row in rows:
            try:
                hrms_id = str(row.get("id") or row.get("hrms_user_id") or "")
                email = (row.get("email") or "").strip().lower()
                username = (row.get("username") or email.split("@")[0] or f"hrms_{hrms_id}")[:50]
                phone = (row.get("phone_number") or row.get("phone") or "")[:15]
                first = (row.get("first_name") or "")[:30]
                last = (row.get("last_name") or "")[:30]
                role_raw = str(row.get("role") or row.get("employee_type") or "Ops").lower()
                role = User.Role.OPS
                for key, val in role_map.items():
                    if key in role_raw:
                        role = val
                        break
                if role == User.Role.ADMIN and not is_superadmin(user):
                    role = User.Role.MANAGER

                existing = None
                if hrms_id:
                    existing = User.objects.filter(organization=org, hrms_user_id=hrms_id).first()
                if not existing and email:
                    existing = User.objects.filter(organization=org, email=email).first()

                if existing:
                    existing.first_name = first or existing.first_name
                    existing.last_name = last or existing.last_name
                    existing.mobile_number = phone or existing.mobile_number
                    existing.hrms_user_id = hrms_id or existing.hrms_user_id
                    existing.is_active_user = True
                    existing.save()
                    updated += 1
                else:
                    # ensure unique username
                    base_u = username
                    n = 1
                    while User.objects.filter(username=username).exists():
                        username = f"{base_u}{n}"[:50]
                        n += 1
                    u = User(
                        username=username,
                        email=email or f"{username}@crm.local",
                        first_name=first,
                        last_name=last,
                        role=role,
                        organization=org,
                        mobile_number=phone,
                        hrms_user_id=hrms_id,
                        is_active_user=True,
                    )
                    u.set_unusable_password()
                    u.save()
                    created += 1
            except Exception as exc:  # noqa: BLE001
                errors.append(str(exc))

        org.hrms_connected = True
        org.save(update_fields=["hrms_connected"])
        return Response({"created": created, "updated": updated, "errors": errors[:20], "fetched": len(rows)})


class VerificationWorkViewSet(viewsets.ModelViewSet):
    serializer_class = VerificationWorkSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        try:
            maybe_backfill_verification_works()
        except Exception:
            pass
        qs = verification_works_for_user(self.request.user)
        status_f = self.request.query_params.get("status")
        if status_f:
            qs = qs.filter(status=status_f)
        mine = self.request.query_params.get("mine")
        if mine == "1":
            qs = qs.filter(assigned_to=self.request.user)
        open_only = self.request.query_params.get("open")
        if open_only == "1":
            qs = qs.filter(status__in=["open", "reopened", "assigned", "in_progress"])
        return qs.order_by("-priority", "-created_at")

    def create(self, request, *args, **kwargs):
        if not can_assign_verification(request.user):
            raise PermissionDenied("Only Manager/TL/Admin can create verification tasks.")
        lead_id = request.data.get("lead")
        lead = Lead.objects.filter(id=lead_id).select_related("project").first()
        if not lead:
            return Response({"detail": "Lead not found."}, status=status.HTTP_404_NOT_FOUND)
        doc = LeadDocument.objects.filter(lead=lead).first()
        work = VerificationWork.objects.create(
            organization=getattr(lead.project, "organization", None),
            lead=lead,
            document=doc,
            title=request.data.get("title") or f"Verify {lead.merchant.name}",
            priority=request.data.get("priority") or VerificationWork.Priority.NORMAL,
            assign_notes=request.data.get("assign_notes") or "",
            allow_edit=bool(request.data.get("allow_edit", True)),
            assigned_by=request.user,
            status=VerificationWork.Status.OPEN,
        )
        return Response(VerificationWorkSerializer(work).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        if not can_assign_verification(request.user):
            raise PermissionDenied("Only Manager/TL/Admin can assign.")
        work = self.get_object()
        assignee_id = request.data.get("assigned_to")
        if not assignee_id:
            return Response({"detail": "assigned_to required."}, status=status.HTTP_400_BAD_REQUEST)
        assignee = User.objects.filter(id=assignee_id, is_active_user=True).first()
        if not assignee:
            return Response({"detail": "Assignee not found."}, status=status.HTTP_404_NOT_FOUND)
        # Must be in hierarchy or Ops in same org
        allowed = users_for_user(request.user).filter(id=assignee.id).exists() or (
            is_admin(request.user) and assignee.organization_id == request.user.organization_id
        ) or is_superadmin(request.user)
        if not allowed and assignee.role != User.Role.OPS:
            # allow Ops under same org even if not in users_for_user edge cases
            if not (
                assignee.role == User.Role.OPS
                and assignee.organization_id
                and assignee.organization_id == getattr(request.user, "organization_id", None)
            ):
                raise PermissionDenied("Cannot assign to this user.")

        work.assigned_to = assignee
        work.assigned_by = request.user
        work.status = VerificationWork.Status.ASSIGNED
        if "due_date" in request.data:
            work.due_date = request.data.get("due_date") or None
        if "assign_notes" in request.data:
            work.assign_notes = request.data.get("assign_notes") or ""
        if "allow_edit" in request.data:
            work.allow_edit = bool(request.data.get("allow_edit"))
        if "priority" in request.data:
            work.priority = request.data.get("priority") or work.priority
        work.save()
        Notification.objects.create(
            user=assignee,
            message=f"Verification assigned: {work.title}",
            link=f"/verification?work={work.id}",
        )
        return Response(VerificationWorkSerializer(work).data)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        work = self.get_object()
        if work.assigned_to_id != request.user.id and not is_admin(request.user):
            raise PermissionDenied("Only assignee can start.")
        work.status = VerificationWork.Status.IN_PROGRESS
        work.save(update_fields=["status", "updated_at"])
        return Response(VerificationWorkSerializer(work).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        work = self.get_object()
        if work.assigned_to_id != request.user.id and not can_assign_verification(request.user):
            raise PermissionDenied("Not allowed.")
        work.status = VerificationWork.Status.DONE
        work.completion_notes = (request.data.get("completion_notes") or "").strip()
        work.completed_at = timezone.now()
        work.save()

        approve_docs = request.data.get("approve_documents", True)
        if approve_docs and work.document_id:
            doc = work.document
            doc.verification_status = LeadDocument.VerificationStatus.APPROVED
            doc.verified_by = request.user
            doc.save(update_fields=["verification_status", "verified_by"])

        # Notify assigner + BDM
        notify_ids = set()
        if work.assigned_by_id:
            notify_ids.add(work.assigned_by_id)
        if work.lead.bdm_id:
            notify_ids.add(work.lead.bdm_id)
        for uid in notify_ids:
            if uid == request.user.id:
                continue
            Notification.objects.create(
                user_id=uid,
                message=f"Verification completed: {work.lead.merchant.name}",
                link=f"/leads?lead={work.lead_id}",
            )
        return Response(VerificationWorkSerializer(work).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        if not can_assign_verification(request.user) and self.get_object().assigned_to_id != request.user.id:
            raise PermissionDenied("Not allowed.")
        work = self.get_object()
        work.status = VerificationWork.Status.REJECTED
        work.completion_notes = (request.data.get("completion_notes") or request.data.get("reason") or "").strip()
        work.completed_at = timezone.now()
        work.save()
        if work.document_id:
            doc = work.document
            doc.verification_status = LeadDocument.VerificationStatus.REJECTED
            doc.verified_by = request.user
            doc.save(update_fields=["verification_status", "verified_by"])
        if work.assigned_by_id and work.assigned_by_id != request.user.id:
            Notification.objects.create(
                user_id=work.assigned_by_id,
                message=f"Verification rejected: {work.lead.merchant.name}",
                link=f"/verification?work={work.id}",
            )
        return Response(VerificationWorkSerializer(work).data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        if not can_assign_verification(request.user):
            raise PermissionDenied("Only Manager/TL/Admin can reopen.")
        work = self.get_object()
        work.status = VerificationWork.Status.REOPENED
        work.completed_at = None
        work.save(update_fields=["status", "completed_at", "updated_at"])
        if work.assigned_to_id:
            Notification.objects.create(
                user_id=work.assigned_to_id,
                message=f"Verification reopened: {work.title}",
                link=f"/verification?work={work.id}",
            )
        return Response(VerificationWorkSerializer(work).data)

    @action(detail=True, methods=["post"], url_path="save-answers")
    def save_answers(self, request, pk=None):
        """Assignee (with allow_edit) or supervisor edits lead form answers."""
        work = self.get_object()
        user = request.user
        if not can_edit_lead_data(user):
            raise PermissionDenied("Edit permission disabled.")
        is_assignee = work.assigned_to_id == user.id
        if is_assignee and not work.allow_edit:
            raise PermissionDenied("This task does not allow editing.")
        if not is_assignee and not can_assign_verification(user) and not is_admin(user):
            raise PermissionDenied("Not allowed.")
        answers = request.data.get("answers")
        if not isinstance(answers, dict):
            return Response({"detail": "answers object required."}, status=status.HTTP_400_BAD_REQUEST)
        lead = work.lead
        from .form_sync import sync_lead_form_data

        sub = sync_lead_form_data(lead, answers, actor=user, bump_submitted_at=True)
        if sub and work.form_submission_id != sub.id:
            work.form_submission = sub
            work.save(update_fields=["form_submission", "updated_at"])
        return Response({"detail": "Saved", "custom_data": lead.custom_data, "submission_id": getattr(sub, "id", None)})

    @action(detail=False, methods=["get"])
    def summary(self, request):
        try:
            maybe_backfill_verification_works()
        except Exception:
            pass
        qs = verification_works_for_user(request.user)
        counts = qs.aggregate(
            open=Count("id", filter=Q(status__in=["open", "reopened"])),
            assigned=Count("id", filter=Q(status="assigned")),
            in_progress=Count("id", filter=Q(status="in_progress")),
            done=Count("id", filter=Q(status="done")),
            rejected=Count("id", filter=Q(status="rejected")),
            mine=Count("id", filter=Q(assigned_to=request.user, status__in=["assigned", "in_progress", "reopened"])),
        )
        return Response(counts)

    @action(detail=False, methods=["get"])
    def assignees(self, request):
        """Office Ops + subordinates available for one-click assign."""
        user = request.user
        if not can_assign_verification(user):
            raise PermissionDenied("Not allowed.")
        qs = users_for_user(user).filter(is_active_user=True).exclude(id=user.id)
        # Prefer Ops, then BDM office staff under hierarchy
        ops = list(qs.filter(role=User.Role.OPS).values("id", "username", "first_name", "last_name", "role")[:50])
        others = list(
            qs.filter(role__in=[User.Role.BDM, User.Role.TL]).values("id", "username", "first_name", "last_name", "role")[:50]
        )
        return Response({"ops": ops, "team": others})


def ensure_verification_work_for_submission(lead, submission=None, actor=None):
    """Create/update open verification work for a lead after BDM form submit or file upload."""
    project = lead.project
    org = getattr(project, "organization", None)
    if org is None:
        org = getattr(lead.bdm, "organization", None)
    doc, _ = LeadDocument.objects.get_or_create(lead=lead)
    existing = (
        VerificationWork.objects.filter(lead=lead, status__in=["open", "assigned", "in_progress", "reopened"])
        .order_by("-created_at")
        .first()
    )
    if existing:
        updates = []
        if submission and existing.form_submission_id != getattr(submission, "id", None):
            existing.form_submission = submission
            updates.append("form_submission")
        if existing.document_id != doc.id:
            existing.document = doc
            updates.append("document")
        if org and existing.organization_id != org.id:
            existing.organization = org
            updates.append("organization")
        if updates:
            updates.append("updated_at")
            existing.save(update_fields=updates)
        return existing
    return VerificationWork.objects.create(
        organization=org,
        lead=lead,
        form_submission=submission,
        document=doc,
        title=f"Verify {lead.merchant.name}",
        status=VerificationWork.Status.OPEN,
        assigned_by=actor,
    )


_last_backfill_at = 0.0


def maybe_backfill_verification_works(limit=300, min_interval_sec=20):
    """Throttle expensive backfill so list/summary stay fast."""
    import time

    global _last_backfill_at
    now = time.time()
    if now - _last_backfill_at < min_interval_sec:
        return 0
    _last_backfill_at = now
    return backfill_verification_works(limit=limit)


def backfill_verification_works(limit=500):
    """Create missing VerificationWork rows for leads that already have form submissions."""
    from .models import FormSubmission, Lead

    created = 0
    sub_lead_ids = list(
        FormSubmission.objects.order_by("-submitted_at").values_list("lead_id", flat=True).distinct()[:limit]
    )
    for lead in Lead.objects.filter(id__in=sub_lead_ids).select_related(
        "project", "project__organization", "bdm", "merchant"
    ):
        org = getattr(lead.project, "organization", None) or getattr(lead.bdm, "organization", None)
        if org:
            VerificationWork.objects.filter(lead=lead, organization_id__isnull=True).update(organization=org)

        has_active = VerificationWork.objects.filter(
            lead=lead, status__in=["open", "assigned", "in_progress", "reopened"]
        ).exists()
        if has_active:
            continue
        sub = FormSubmission.objects.filter(lead=lead).order_by("-submitted_at").first()
        ensure_verification_work_for_submission(lead, sub, actor=getattr(sub, "submitted_by", None))
        created += 1
    return created
