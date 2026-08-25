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
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .entitlements import (
    apply_package_to_org,
    ensure_default_packages,
    get_default_package,
    module_catalog_payload,
    sanitize_modules,
)
from .models import (
    Lead,
    LeadDocument,
    Notification,
    Organization,
    OrganizationDocument,
    Project,
    SubscriptionPackage,
    VerificationWork,
)
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
    OrganizationDocumentSerializer,
    OrganizationSerializer,
    OrganizationWriteSerializer,
    SubscriptionPackageSerializer,
    VerificationWorkSerializer,
)

ORG_DOC_FILE_KEYS = {
    "gst_certificate": OrganizationDocument.DocType.GST,
    "pan_card": OrganizationDocument.DocType.PAN,
    "incorporation": OrganizationDocument.DocType.INCORPORATION,
    "address_proof": OrganizationDocument.DocType.ADDRESS,
    "cancelled_cheque": OrganizationDocument.DocType.CHEQUE,
    "other_doc": OrganizationDocument.DocType.OTHER,
    "gst_file": OrganizationDocument.DocType.GST,
    "pan_file": OrganizationDocument.DocType.PAN,
}


def _save_org_registration_docs(org, request, uploaded_by=None):
    saved = 0
    for key, doc_type in ORG_DOC_FILE_KEYS.items():
        f = request.FILES.get(key)
        if not f:
            continue
        OrganizationDocument.objects.create(
            organization=org,
            doc_type=doc_type,
            label=f.name,
            file=f,
            uploaded_by=uploaded_by,
            status=OrganizationDocument.Status.PENDING,
        )
        saved += 1
    # Multiple extras: doc_0, doc_1…
    for key, f in request.FILES.items():
        if key in ORG_DOC_FILE_KEYS:
            continue
        if not str(key).startswith("doc"):
            continue
        OrganizationDocument.objects.create(
            organization=org,
            doc_type=OrganizationDocument.DocType.OTHER,
            label=f.name,
            file=f,
            uploaded_by=uploaded_by,
            status=OrganizationDocument.Status.PENDING,
        )
        saved += 1
    if saved:
        org.docs_verification_status = Organization.DocsVerificationStatus.IN_REVIEW
        org.docs_rejection_reason = ""
        org.save(update_fields=["docs_verification_status", "docs_rejection_reason"])
    return saved

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
    """Public company registration → pending Super Admin document verify + approval."""

    authentication_classes = []  # ignore stale JWTs from browser localStorage
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        name = (request.data.get("company_name") or request.data.get("name") or "").strip()
        email = (request.data.get("email") or "").strip().lower()
        phone = (request.data.get("phone") or "").strip()
        city = (request.data.get("city") or "").strip()
        admin_name = (request.data.get("admin_name") or "").strip()
        admin_username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        trial_raw = request.data.get("trial", True)
        want_trial = str(trial_raw).lower() in ("1", "true", "yes", "on") if not isinstance(trial_raw, bool) else trial_raw
        accept_terms = str(request.data.get("accept_terms", "")).lower() in ("1", "true", "yes", "on")

        if not name or not email or not admin_username or len(password) < 6:
            return Response(
                {"detail": "company_name, email, username and password (min 6) are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not accept_terms:
            return Response(
                {"detail": "Please accept Terms & Conditions and Privacy Policy to register."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        gst = request.FILES.get("gst_certificate")
        pan = request.FILES.get("pan_card")
        if not gst or not pan:
            return Response(
                {"detail": "GST certificate and Company PAN are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(username=admin_username).exists():
            return Response({"detail": "Username already taken."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email=email).exists():
            return Response({"detail": "Email already registered."}, status=status.HTTP_400_BAD_REQUEST)

        pkg = get_default_package()
        trial_days = (pkg.trial_days if pkg else 15) or 15
        org = Organization.objects.create(
            name=name,
            slug=_unique_slug(name),
            email=email,
            phone=phone,
            city=city,
            admin_name=admin_name or admin_username,
            status=Organization.Status.PENDING,
            plan_label=(pkg.name if pkg else "Trial") if want_trial else "Paid pending",
            trial_ends_at=timezone.now() + timedelta(days=trial_days) if want_trial else None,
            package=pkg,
            enabled_modules=sanitize_modules((pkg.module_keys if pkg else None)),
            payment_status=Organization.PaymentStatus.NONE,
            docs_verification_status=Organization.DocsVerificationStatus.PENDING,
        )
        admin = User.objects.create_user(
            username=admin_username,
            email=email,
            password=password,
            first_name=(admin_name or admin_username).split(" ")[0][:30],
            role=User.Role.ADMIN,
            organization=org,
            mobile_number=phone,
            is_active_user=False,  # until Super Admin verifies docs + approves
        )
        docs_count = _save_org_registration_docs(org, request, uploaded_by=None)
        # Notify Super Admins
        for sa in User.objects.filter(role=User.Role.SUPERADMIN, is_active_user=True)[:10]:
            Notification.objects.create(
                user=sa,
                message=f"New company registration: {org.name} — verify corporate docs ({docs_count} files), then approve",
                link="/admin/organizations",
            )
        org.refresh_from_db()
        return Response(
            {
                "detail": (
                    "Registration received. Super Admin will verify your corporate documents, "
                    "then enable trial or paid access."
                ),
                "organization": OrganizationSerializer(org).data,
                "documents_uploaded": docs_count,
                "admin_user_id": admin.id,
            },
            status=status.HTTP_201_CREATED,
        )


class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all().prefetch_related("documents")
    permission_classes = [IsAuthenticated]
    pagination_class = None
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return OrganizationWriteSerializer
        return OrganizationSerializer

    def get_queryset(self):
        user = self.request.user
        # Platform company list / manage is Super Admin only.
        # Company Admin may still retrieve/sync their own org (HRMS).
        base = Organization.objects.all().prefetch_related("documents")
        if is_superadmin(user):
            return base
        if is_company_admin(user) and user.organization_id and self.action in (
            "retrieve",
            "sync_hrms_employees",
            "partial_update",
            "update",
            "documents",
        ):
            return base.filter(id=user.organization_id)
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
        from .entitlements import ensure_org_entitlements

        ensure_default_packages()
        for org in Organization.objects.all().iterator():
            if not org.enabled_modules:
                ensure_org_entitlements(org)
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

    def _apply_package_from_request(self, org, request, *, paid: bool):
        package_id = request.data.get("package_id")
        package = None
        if package_id:
            package = SubscriptionPackage.objects.filter(id=package_id, is_active=True).first()
        if package is None:
            package = org.package or get_default_package()
        if package:
            apply_package_to_org(org, package, keep_custom=bool(request.data.get("keep_modules")))
        if "modules" in request.data:
            org.enabled_modules = sanitize_modules(request.data.get("modules"))
        if paid:
            org.payment_status = Organization.PaymentStatus.PAID
            org.paid_at = timezone.now()
            if request.data.get("amount") is not None:
                org.amount_paid = request.data.get("amount")
            elif package:
                org.amount_paid = package.price
        return org

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        org = self.get_object()
        mode = (request.data.get("mode") or "active").lower()
        if mode == "trial":
            pkg = org.package or get_default_package()
            days = int(request.data.get("trial_days") or (pkg.trial_days if pkg else 15) or 15)
            org.status = Organization.Status.TRIAL
            org.trial_ends_at = timezone.now() + timedelta(days=max(1, days))
            org.payment_status = Organization.PaymentStatus.NONE
            self._apply_package_from_request(org, request, paid=False)
            org.plan_label = (request.data.get("plan_label") or org.plan_label or "Trial").strip()
        else:
            org.status = Organization.Status.ACTIVE
            org.trial_ends_at = None
            self._apply_package_from_request(org, request, paid=True)
            org.plan_label = (request.data.get("plan_label") or org.plan_label or "Paid").strip()
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
        force = bool(request.data.get("force"))
        if org.docs_verification_status != Organization.DocsVerificationStatus.VERIFIED and not force:
            return Response(
                {
                    "detail": (
                        "Verify corporate documents first (or pass force=1 to override). "
                        f"Current docs status: {org.docs_verification_status}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        mode = (request.data.get("mode") or "trial").lower()  # trial | active
        pkg = None
        if request.data.get("package_id"):
            pkg = SubscriptionPackage.objects.filter(id=request.data["package_id"], is_active=True).first()
        if pkg is None:
            pkg = get_default_package()
        days = int(request.data.get("trial_days") or (pkg.trial_days if pkg else 15) or 15)
        plan = (request.data.get("plan_label") or "").strip()
        payment_notes = (request.data.get("payment_notes") or "").strip()
        publish = bool(request.data.get("is_public", True))

        if mode == "active":
            org.status = Organization.Status.ACTIVE
            org.trial_ends_at = None
            self._apply_package_from_request(org, request, paid=True)
            org.plan_label = plan or (pkg.name if pkg else "Paid")
        else:
            org.status = Organization.Status.TRIAL
            org.trial_ends_at = timezone.now() + timedelta(days=max(1, days))
            org.payment_status = Organization.PaymentStatus.NONE
            self._apply_package_from_request(org, request, paid=False)
            org.plan_label = plan or (pkg.name if pkg else "Trial")
        if payment_notes:
            org.payment_notes = payment_notes
        if force and org.docs_verification_status != Organization.DocsVerificationStatus.VERIFIED:
            org.docs_verification_status = Organization.DocsVerificationStatus.VERIFIED
            org.docs_verified_at = timezone.now()
            org.docs_verified_by = request.user
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

    @action(detail=True, methods=["get", "post"])
    def documents(self, request, pk=None):
        """List or upload corporate documents (Super Admin upload / company view)."""
        org = self.get_object()
        user = request.user
        if not (
            is_superadmin(user)
            or (is_company_admin(user) and user.organization_id == org.id)
        ):
            raise PermissionDenied("Not allowed.")
        if request.method == "GET":
            return Response(
                {
                    "docs_verification_status": org.docs_verification_status,
                    "docs_rejection_reason": org.docs_rejection_reason,
                    "results": OrganizationDocumentSerializer(org.documents.all(), many=True).data,
                }
            )
        # POST upload (Super Admin can always upload; company admin while pending)
        if not is_superadmin(user) and org.status not in (
            Organization.Status.PENDING,
            Organization.Status.REJECTED,
        ):
            return Response(
                {"detail": "Documents can only be re-uploaded while registration is pending."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        count = _save_org_registration_docs(org, request, uploaded_by=user if user.is_authenticated else None)
        if not count:
            return Response({"detail": "No files uploaded."}, status=status.HTTP_400_BAD_REQUEST)
        org.refresh_from_db()
        return Response(
            {
                "uploaded": count,
                "organization": OrganizationSerializer(org).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path=r"documents/(?P<doc_id>[0-9]+)/review")
    def review_document(self, request, pk=None, doc_id=None):
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        org = self.get_object()
        doc = org.documents.filter(id=doc_id).first()
        if not doc:
            return Response({"detail": "Document not found."}, status=status.HTTP_404_NOT_FOUND)
        decision = (request.data.get("status") or request.data.get("decision") or "").strip().lower()
        if decision not in ("approved", "rejected", "pending"):
            return Response({"detail": "status must be approved, rejected, or pending."}, status=400)
        doc.status = decision
        doc.notes = (request.data.get("notes") or doc.notes or "").strip()
        doc.verified_by = request.user
        doc.verified_at = timezone.now()
        doc.save()
        # Roll up org docs status when all reviewed
        pending = org.documents.filter(status=OrganizationDocument.Status.PENDING).exists()
        rejected = org.documents.filter(status=OrganizationDocument.Status.REJECTED).exists()
        if not org.documents.exists():
            org.docs_verification_status = Organization.DocsVerificationStatus.PENDING
        elif pending:
            org.docs_verification_status = Organization.DocsVerificationStatus.IN_REVIEW
        elif rejected:
            org.docs_verification_status = Organization.DocsVerificationStatus.REJECTED
            org.docs_rejection_reason = (request.data.get("org_reason") or doc.notes or "Documents rejected").strip()
        else:
            org.docs_verification_status = Organization.DocsVerificationStatus.VERIFIED
            org.docs_verified_at = timezone.now()
            org.docs_verified_by = request.user
            org.docs_rejection_reason = ""
        org.save()
        return Response(
            {
                "document": OrganizationDocumentSerializer(doc).data,
                "organization": OrganizationSerializer(org).data,
            }
        )

    @action(detail=True, methods=["post"])
    def verify_documents(self, request, pk=None):
        """Mark all corporate docs verified (or reject the pack)."""
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        org = self.get_object()
        decision = (request.data.get("status") or "verified").strip().lower()
        if decision in ("verified", "approve", "approved"):
            if not org.documents.exists() and not request.data.get("force"):
                return Response(
                    {"detail": "No corporate documents uploaded. Upload files or pass force=1."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            org.documents.filter(status=OrganizationDocument.Status.PENDING).update(
                status=OrganizationDocument.Status.APPROVED,
                verified_by=request.user,
                verified_at=timezone.now(),
            )
            org.docs_verification_status = Organization.DocsVerificationStatus.VERIFIED
            org.docs_verified_at = timezone.now()
            org.docs_verified_by = request.user
            org.docs_rejection_reason = ""
        elif decision in ("rejected", "reject"):
            org.docs_verification_status = Organization.DocsVerificationStatus.REJECTED
            org.docs_rejection_reason = (request.data.get("reason") or "Corporate documents rejected").strip()
            org.documents.filter(status=OrganizationDocument.Status.PENDING).update(
                status=OrganizationDocument.Status.REJECTED,
                verified_by=request.user,
                verified_at=timezone.now(),
                notes=org.docs_rejection_reason,
            )
        else:
            return Response({"detail": "status must be verified or rejected."}, status=400)
        org.save()
        for admin in User.objects.filter(organization=org, role=User.Role.ADMIN):
            Notification.objects.create(
                user=admin,
                message=(
                    f"Corporate documents {org.docs_verification_status} for {org.name}."
                    if org.docs_verification_status != Organization.DocsVerificationStatus.REJECTED
                    else f"Corporate documents rejected: {org.docs_rejection_reason}"
                ),
                link="/login",
            )
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
            org.trial_ends_at = timezone.now() + timedelta(days=max(0, int(request.data["trial_days"])))
        if "delta_days" in request.data:
            delta = int(request.data["delta_days"])
            base = org.trial_ends_at or timezone.now()
            if base < timezone.now() and delta > 0:
                base = timezone.now()
            org.trial_ends_at = base + timedelta(days=delta)
            if org.status == Organization.Status.ACTIVE and delta != 0:
                pass
            elif org.status in (Organization.Status.TRIAL, Organization.Status.SUSPENDED, Organization.Status.ACTIVE):
                if org.status != Organization.Status.ACTIVE:
                    org.status = Organization.Status.TRIAL
        if "package_id" in request.data or "modules" in request.data:
            paid = status_val == Organization.Status.ACTIVE or org.status == Organization.Status.ACTIVE
            self._apply_package_from_request(org, request, paid=paid and request.data.get("mark_paid", paid))
        if request.data.get("mark_paid") or status_val == Organization.Status.ACTIVE:
            org.payment_status = Organization.PaymentStatus.PAID
            org.paid_at = org.paid_at or timezone.now()
            if request.data.get("amount") is not None:
                org.amount_paid = request.data.get("amount")
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

    @action(detail=True, methods=["post"])
    def adjust_trial(self, request, pk=None):
        """Increase or decrease trial by delta_days (relative to current end)."""
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        org = self.get_object()
        if "delta_days" not in request.data and "trial_days" not in request.data:
            return Response(
                {"detail": "Provide delta_days (e.g. +5 / -3) or trial_days (absolute from now)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if "delta_days" in request.data:
            delta = int(request.data["delta_days"])
            base = org.trial_ends_at or timezone.now()
            if base < timezone.now() and delta > 0:
                base = timezone.now()
            org.trial_ends_at = base + timedelta(days=delta)
        else:
            org.trial_ends_at = timezone.now() + timedelta(days=max(0, int(request.data["trial_days"])))
        if org.status != Organization.Status.ACTIVE:
            org.status = Organization.Status.TRIAL
        if "payment_notes" in request.data:
            org.payment_notes = request.data.get("payment_notes") or ""
        org.save()
        return Response(OrganizationSerializer(org).data)

    @action(detail=True, methods=["post"])
    def set_modules(self, request, pk=None):
        """Super Admin override of modules this company can open."""
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        org = self.get_object()
        org.enabled_modules = sanitize_modules(request.data.get("modules") or [])
        if request.data.get("package_id"):
            pkg = SubscriptionPackage.objects.filter(id=request.data["package_id"]).first()
            if pkg:
                org.package = pkg
                org.plan_label = pkg.name
                org.package_assigned_at = timezone.now()
        org.save()
        return Response(OrganizationSerializer(org).data)

    @action(detail=True, methods=["post"])
    def record_payment(self, request, pk=None):
        """Mark successful payment → unlock subscribed package modules."""
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        org = self.get_object()
        self._apply_package_from_request(org, request, paid=True)
        org.status = Organization.Status.ACTIVE
        org.trial_ends_at = None
        org.payment_status = Organization.PaymentStatus.PAID
        org.paid_at = timezone.now()
        if request.data.get("amount") is not None:
            org.amount_paid = request.data.get("amount")
        elif org.package_id and org.amount_paid is None:
            org.amount_paid = org.package.price
        if "payment_notes" in request.data:
            org.payment_notes = request.data.get("payment_notes") or ""
        if "plan_label" in request.data:
            org.plan_label = (request.data.get("plan_label") or org.plan_label).strip()
        org.is_public = bool(request.data.get("is_public", True))
        org.approved_by = request.user
        org.approved_at = timezone.now()
        org.save()
        User.objects.filter(organization=org, role=User.Role.ADMIN).update(is_active_user=True, is_active=True)
        return Response(OrganizationSerializer(org).data)


class SubscriptionPackageViewSet(viewsets.ModelViewSet):
    """Super Admin CRUD for subscription packages (budget + modules)."""

    queryset = SubscriptionPackage.objects.all()
    serializer_class = SubscriptionPackageSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        ensure_default_packages()

    def get_queryset(self):
        if not is_superadmin(self.request.user):
            return SubscriptionPackage.objects.none()
        qs = SubscriptionPackage.objects.all()
        if self.request.query_params.get("active") == "1":
            qs = qs.filter(is_active=True)
        return qs

    def create(self, request, *args, **kwargs):
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        pkg = self.get_object()
        if pkg.is_default:
            return Response({"detail": "Cannot delete the default package."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def module_catalog(self, request):
        if not is_superadmin(request.user):
            raise PermissionDenied("Only Super Admin.")
        ensure_default_packages()
        return Response({"modules": module_catalog_payload()})

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
    if org is None and actor is not None:
        org = getattr(actor, "organization", None)
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
        # Always refresh title so queue is recognisable
        new_title = f"Verify {lead.merchant.name}"
        if existing.title != new_title:
            existing.title = new_title
            updates.append("title")
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
