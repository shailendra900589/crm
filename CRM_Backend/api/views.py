from datetime import date, datetime, timedelta
import os

from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Count, Max, Q
from django.db.models.functions import TruncWeek
from django.http import FileResponse
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BulkUploadJob, CustomForm, FormSubmission, Lead, LeadDocument, LeadVisit, Merchant, Notification, Product, Project, SalesTarget, Team
from .permissions import (
    can_assign_visits,
    can_manage_team,
    can_reassign_leads,
    can_reassign_to,
    find_duplicate_leads,
    get_descendant_ids,
    is_admin,
    leads_for_user,
    teams_for_user,
    user_can_access_project_form,
    users_for_user,
    validate_form_answers,
    my_assigned_visits,
    visits_for_user,
)
from .serializers import (
    BulkUploadJobSerializer,
    CustomFormSerializer,
    FormSubmissionSerializer,
    LeadCreateSerializer,
    LeadDocumentSerializer,
    LeadSerializer,
    LeadUpdateSerializer,
    LeadVisitSerializer,
    MerchantSerializer,
    NotificationSerializer,
    ProjectSerializer,
    ProductSerializer,
    SalesTargetSerializer,
    TeamSerializer,
    UserCreateSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from .tasks import generate_bulk_template, process_bulk_upload

User = get_user_model()

def filter_by_project(request, qs):
    project_id = request.query_params.get("project")
    if project_id:
        return qs.filter(project_id=project_id)
    return qs


def admin_filter_leads(request, qs):
    qs = filter_by_project(request, qs)
    manager_id = request.query_params.get("manager")
    team_id = request.query_params.get("team")
    product_id = request.query_params.get("product")
    company_id = request.query_params.get("company")
    date_from = request.query_params.get("from")
    date_to = request.query_params.get("to")
    if manager_id:
        from .permissions import get_descendant_ids
        ids = get_descendant_ids(User.objects.get(id=manager_id))
        ids.add(int(manager_id))
        qs = qs.filter(bdm_id__in=ids)
    if team_id:
        team = Team.objects.filter(id=team_id).prefetch_related("members").first()
        if team:
            member_ids = list(team.members.values_list("id", flat=True))
            qs = qs.filter(bdm_id__in=member_ids)
    if product_id:
        qs = qs.filter(product_id=product_id)
    if company_id:
        qs = qs.filter(merchant_id=company_id)
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    return qs


def dashboard_filter_leads(request, qs):
    qs = filter_by_project(request, qs)
    product_id = request.query_params.get("product")
    company_id = request.query_params.get("company")
    date_from = request.query_params.get("from")
    date_to = request.query_params.get("to")
    if product_id:
        qs = qs.filter(product_id=product_id)
    if company_id:
        qs = qs.filter(merchant_id=company_id)
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    return qs

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        """Update own profile (name, email, mobile). Role/projects are admin-only."""
        allowed = {"first_name", "last_name", "email", "mobile_number"}
        data = {k: v for k, v in request.data.items() if k in allowed}
        for key, value in data.items():
            setattr(request.user, key, value if value is not None else "")
        if data:
            request.user.save(update_fields=list(data.keys()))
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current = request.data.get("current_password") or ""
        new_password = request.data.get("new_password") or ""
        confirm = request.data.get("confirm_password") or ""

        if not request.user.check_password(current):
            return Response({"detail": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 6:
            return Response({"detail": "New password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)
        if new_password != confirm:
            return Response({"detail": "New password and confirmation do not match."}, status=status.HTTP_400_BAD_REQUEST)
        if new_password == current:
            return Response({"detail": "New password must be different from current password."}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])
        from .audit import log_audit
        from .models import Notification
        Notification.objects.create(
            user=request.user,
            message="Your password was changed successfully.",
            link="/profile",
        )
        log_audit(
            request.user,
            action="user.password_changed",
            entity_type="User",
            entity_id=request.user.id,
            message=f"Password changed for {request.user.username}",
        )
        return Response({"detail": "Password updated."})


class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 2:
            return Response({"leads": [], "companies": [], "products": [], "projects": []})

        leads_qs = leads_for_user(request.user).select_related("merchant", "project", "product", "bdm").filter(
            Q(merchant__name__icontains=q)
            | Q(merchant__mobile__icontains=q)
            | Q(merchant__city__icontains=q)
            | Q(merchant__brand_name__icontains=q)
            | Q(notes__icontains=q)
        )[:8]

        companies_qs = (
            Merchant.objects.filter(
                Q(name__icontains=q) | Q(mobile__icontains=q) | Q(city__icontains=q) | Q(brand_name__icontains=q)
            )
            .select_related("project")
            .order_by("name")[:6]
        )
        if not is_admin(request.user):
            lead_project_ids = leads_for_user(request.user).values_list("project_id", flat=True).distinct()
            companies_qs = companies_qs.filter(project_id__in=lead_project_ids)

        products_qs = Product.objects.filter(Q(name__icontains=q) | Q(description__icontains=q), is_active=True).select_related("project")[:6]
        if not is_admin(request.user):
            products_qs = products_qs.filter(project_id__in=request.user.assigned_projects.values_list("id", flat=True))

        projects_qs = Project.objects.filter(Q(name__icontains=q) | Q(description__icontains=q), is_active=True)[:6]
        if not is_admin(request.user):
            projects_qs = projects_qs.filter(id__in=request.user.assigned_projects.values_list("id", flat=True))

        return Response({
            "leads": [
                {
                    "id": l.id,
                    "merchant_name": l.merchant.name,
                    "city": l.merchant.city,
                    "project_name": l.project.name,
                    "product_name": l.product.name if l.product_id else None,
                    "status": l.get_status_display(),
                    "bdm_name": l.bdm.get_full_name() or l.bdm.username,
                }
                for l in leads_qs
            ],
            "companies": [
                {
                    "id": m.id,
                    "name": m.name,
                    "city": m.city,
                    "mobile": m.mobile,
                    "project_id": m.project_id,
                    "project_name": m.project.name,
                }
                for m in companies_qs
            ],
            "products": [
                {
                    "id": p.id,
                    "name": p.name,
                    "project_id": p.project_id,
                    "project_name": p.project.name,
                }
                for p in products_qs
            ],
            "projects": [
                {"id": p.id, "name": p.name, "color": p.color, "description": p.description}
                for p in projects_qs
            ],
        })


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.annotate(lead_count=Count("leads")).order_by("name")
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "list" and not is_admin(self.request.user):
            return qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only Manager can add projects.")
        name = serializer.validated_data["name"]
        slug = slugify(name)
        base, i = slug, 1
        while Project.objects.filter(slug=slug).exists():
            slug = f"{base}-{i}"
            i += 1
        serializer.save(slug=slug, created_by=self.request.user)

    def perform_update(self, serializer):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only Manager can edit projects.")
        serializer.save()

    def perform_destroy(self, instance):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only Manager can delete projects.")
        instance.delete()

    @action(detail=True, methods=["get", "put"], url_path="custom-form")
    def custom_form(self, request, pk=None):
        project = self.get_object()
        if request.method == "GET":
            form, _ = CustomForm.objects.get_or_create(project=project, defaults={"title": f"{project.name} Form"})
            return Response(CustomFormSerializer(form).data)
        if not is_admin(request.user):
            raise PermissionDenied("Manager only.")
        form, _ = CustomForm.objects.get_or_create(project=project)
        serializer = CustomFormSerializer(form, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(created_by=request.user)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="bulk-template")
    def bulk_template(self, request, pk=None):
        project = self.get_object()
        buf = generate_bulk_template(project)
        return FileResponse(buf, as_attachment=True, filename=f"{project.slug}_template.xlsx")

    @action(detail=True, methods=["post"], url_path="bulk-upload", parser_classes=[MultiPartParser])
    def bulk_upload(self, request, pk=None):
        project = self.get_object()
        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "file required"}, status=400)
        job = BulkUploadJob.objects.create(project=project, uploaded_by=request.user, file=file)
        try:
            from .tasks import process_bulk_upload_task
            process_bulk_upload_task.delay(job.id)
        except Exception:
            process_bulk_upload(job.id)
        return Response(BulkUploadJobSerializer(job).data, status=201)


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related("project").annotate(lead_count=Count("leads")).order_by("name")
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        if self.action == "list" and not is_admin(self.request.user):
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only Admin can add products.")
        name = serializer.validated_data["name"]
        project = serializer.validated_data["project"]
        slug = slugify(name)
        base, i = slug, 1
        while Product.objects.filter(project=project, slug=slug).exists():
            slug = f"{base}-{i}"
            i += 1
        serializer.save(slug=slug)

    def perform_update(self, serializer):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only Admin can edit products.")
        serializer.save()

    def perform_destroy(self, instance):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only Admin can delete products.")
        instance.delete()


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        leads = dashboard_filter_leads(request, leads_for_user(request.user))
        data = self._stats(leads)
        data.update(self._workdesk(request))
        data.update(self._filter_meta(request, leads))
        return Response(data)

    @staticmethod
    def _stats(leads):
        total = leads.count()
        confirmed = leads.filter(status=Lead.Status.ORDER_CONFIRMED).count()
        due_today = leads.filter(follow_up_date=date.today()).count()
        overdue = leads.filter(follow_up_date__lt=date.today()).exclude(
            status__in=[Lead.Status.ORDER_CONFIRMED, Lead.Status.NOT_INTERESTED]
        ).count()
        conversion = round((confirmed / total * 100) if total else 0, 1)
        disposition = leads.values("status").annotate(count=Count("id")).order_by("-count")
        leaderboard = (
            leads.values("bdm__username", "bdm__first_name")
            .annotate(confirmed=Count("id", filter=Q(status=Lead.Status.ORDER_CONFIRMED)))
            .order_by("-confirmed")[:5]
        )
        return {
            "total_leads": total,
            "orders_confirmed": confirmed,
            "follow_ups_due_today": due_today,
            "overdue_follow_ups": overdue,
            "conversion_rate": conversion,
            "disposition": list(disposition),
            "leaderboard": list(leaderboard),
        }

    @staticmethod
    def _filter_meta(request, leads):
        total_companies = leads.values("merchant_id").distinct().count()
        company_rows = (
            leads.values("merchant_id", "merchant__name", "merchant__city")
            .annotate(
                lead_count=Count("id"),
                confirmed_count=Count("id", filter=Q(status=Lead.Status.ORDER_CONFIRMED)),
            )
            .order_by("-lead_count")[:12]
        )
        company_stats = [
            {
                "id": row["merchant_id"],
                "name": row["merchant__name"],
                "city": row["merchant__city"] or "",
                "lead_count": row["lead_count"],
                "confirmed_count": row["confirmed_count"],
                "conversion": round((row["confirmed_count"] / row["lead_count"] * 100) if row["lead_count"] else 0, 1),
            }
            for row in company_rows
        ]
        product_rows = (
            leads.exclude(product_id__isnull=True)
            .values("product_id", "product__name", "product__project_id")
            .annotate(
                lead_count=Count("id"),
                confirmed_count=Count("id", filter=Q(status=Lead.Status.ORDER_CONFIRMED)),
            )
            .order_by("-lead_count")
        )
        product_stats = [
            {
                "id": row["product_id"],
                "name": row["product__name"],
                "project_id": row["product__project_id"],
                "lead_count": row["lead_count"],
                "confirmed_count": row["confirmed_count"],
                "conversion": round((row["confirmed_count"] / row["lead_count"] * 100) if row["lead_count"] else 0, 1),
            }
            for row in product_rows
        ]
        project_id = request.query_params.get("project")
        project_name = None
        if project_id:
            project_name = Project.objects.filter(id=project_id).values_list("name", flat=True).first()
        return {
            "total_companies": total_companies,
            "total_products": product_rows.count(),
            "company_stats": company_stats,
            "product_stats": product_stats,
            "filter_summary": {
                "project_id": int(project_id) if project_id else None,
                "project_name": project_name,
                "product_id": int(request.query_params.get("product")) if request.query_params.get("product") else None,
                "company_id": int(request.query_params.get("company")) if request.query_params.get("company") else None,
                "from": request.query_params.get("from"),
                "to": request.query_params.get("to"),
            },
        }

    @staticmethod
    def _workdesk(request):
        project_id = request.query_params.get("project")
        if not project_id:
            return DashboardView._empty_workdesk()

        pid = int(project_id)
        user = request.user
        if not user_can_access_project_form(user, pid):
            return DashboardView._empty_workdesk()

        form = CustomForm.objects.filter(project_id=pid, is_active=True).first()
        today = date.today()

        sub_qs = FormSubmission.objects.filter(custom_form__project_id=pid).select_related(
            "lead", "submitted_by", "custom_form"
        )
        if user.role == User.Role.BDM:
            sub_qs = sub_qs.filter(submitted_by=user)
        elif not is_admin(user):
            ids = get_descendant_ids(user)
            ids.add(user.id)
            sub_qs = sub_qs.filter(submitted_by_id__in=ids)

        visits_qs = visits_for_user(user).filter(lead__project_id=pid)
        my_visits_qs = my_assigned_visits(user).filter(lead__project_id=pid)
        upcoming = my_visits_qs.filter(
            status=LeadVisit.Status.SCHEDULED, scheduled_date__gte=today
        ).order_by("scheduled_date")[:12]
        next_visit = upcoming.first()

        recent = sub_qs.order_by("-submitted_at")[:8]
        visited_lead_ids = visits_qs.filter(status=LeadVisit.Status.COMPLETED).values_list("lead_id", flat=True)
        revisit_leads = (
            leads_for_user(user)
            .filter(project_id=pid, id__in=visited_lead_ids)
            .select_related("merchant", "bdm")
            .annotate(last_visit=Max("visits__scheduled_date"))
            .order_by("-last_visit")[:20]
        )

        team_activity = []
        if user.role in (User.Role.ADMIN, User.Role.MANAGER, User.Role.TL):
            team_activity = FormSubmissionSerializer(
                sub_qs.filter(submitted_at__date=today).order_by("-submitted_at")[:10],
                many=True,
            ).data

        return {
            "project_form": CustomFormSerializer(form).data if form else None,
            "forms_filled_today": sub_qs.filter(submitted_at__date=today).count(),
            "next_visit": LeadVisitSerializer(next_visit).data if next_visit else None,
            "upcoming_visits": LeadVisitSerializer(upcoming, many=True).data,
            "recent_submissions": FormSubmissionSerializer(recent, many=True).data,
            "revisit_leads": [
                {
                    "id": l.id,
                    "merchant_name": l.merchant.name,
                    "merchant_city": l.merchant.city,
                    "bdm_name": l.bdm.get_full_name() or l.bdm.username,
                    "bdm_id": l.bdm_id,
                    "last_visit": str(l.last_visit) if l.last_visit else None,
                    "status": l.status,
                }
                for l in revisit_leads
            ],
            "team_form_activity": team_activity,
        }

    @staticmethod
    def _empty_workdesk():
        return {
            "project_form": None,
            "forms_filled_today": 0,
            "next_visit": None,
            "upcoming_visits": [],
            "recent_submissions": [],
            "revisit_leads": [],
            "team_form_activity": [],
        }


class AdminDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_admin(request.user):
            raise PermissionDenied("Only Manager can access admin dashboard.")

        all_leads = admin_filter_leads(request, Lead.objects.select_related("project", "bdm", "merchant", "product"))
        total_leads = all_leads.count()
        confirmed = all_leads.filter(status=Lead.Status.ORDER_CONFIRMED).count()
        due_today = all_leads.filter(follow_up_date=date.today()).count()
        overdue = all_leads.filter(follow_up_date__lt=date.today()).exclude(
            status__in=[Lead.Status.ORDER_CONFIRMED, Lead.Status.NOT_INTERESTED]
        ).count()
        total_companies = all_leads.values("merchant_id").distinct().count()

        project_filter = request.query_params.get("project")
        projects = Project.objects.annotate(
            lead_count=Count("leads"),
            confirmed_count=Count("leads", filter=Q(leads__status=Lead.Status.ORDER_CONFIRMED)),
        ).order_by("name")
        if project_filter:
            projects = projects.filter(id=project_filter)

        project_stats = [
            {
                "id": p.id,
                "name": p.name,
                "color": p.color,
                "is_active": p.is_active,
                "lead_count": p.lead_count,
                "confirmed_count": p.confirmed_count,
                "conversion": round((p.confirmed_count / p.lead_count * 100) if p.lead_count else 0, 1),
            }
            for p in projects
        ]

        company_rows = (
            all_leads.values("merchant_id", "merchant__name", "merchant__city", "project__name")
            .annotate(
                lead_count=Count("id"),
                confirmed_count=Count("id", filter=Q(status=Lead.Status.ORDER_CONFIRMED)),
            )
            .order_by("-lead_count")[:20]
        )
        company_stats = [
            {
                "id": row["merchant_id"],
                "name": row["merchant__name"],
                "city": row["merchant__city"] or "",
                "project_name": row["project__name"],
                "lead_count": row["lead_count"],
                "confirmed_count": row["confirmed_count"],
                "conversion": round((row["confirmed_count"] / row["lead_count"] * 100) if row["lead_count"] else 0, 1),
            }
            for row in company_rows
        ]

        products_qs = Product.objects.select_related("project")
        if project_filter:
            products_qs = products_qs.filter(project_id=project_filter)
        product_catalog = {p.id: p for p in products_qs}
        product_rows = (
            all_leads.exclude(product_id__isnull=True)
            .values("product_id", "product__name", "product__project_id", "project__name")
            .annotate(
                lead_count=Count("id"),
                confirmed_count=Count("id", filter=Q(status=Lead.Status.ORDER_CONFIRMED)),
            )
            .order_by("-lead_count")
        )
        product_stats = [
            {
                "id": row["product_id"],
                "name": row["product__name"],
                "project_id": row["product__project_id"],
                "project_name": row["project__name"],
                "lead_count": row["lead_count"],
                "confirmed_count": row["confirmed_count"],
                "conversion": round((row["confirmed_count"] / row["lead_count"] * 100) if row["lead_count"] else 0, 1),
            }
            for row in product_rows
        ]
        for pid, product in product_catalog.items():
            if not any(p["id"] == pid for p in product_stats):
                product_stats.append({
                    "id": product.id,
                    "name": product.name,
                    "project_id": product.project_id,
                    "project_name": product.project.name,
                    "lead_count": 0,
                    "confirmed_count": 0,
                    "conversion": 0,
                })
        product_stats.sort(key=lambda x: (-x["lead_count"], x["name"]))

        team = (
            User.objects.filter(role=User.Role.BDM)
            .annotate(
                lead_count=Count("leads"),
                confirmed=Count("leads", filter=Q(leads__status=Lead.Status.ORDER_CONFIRMED)),
            )
            .order_by("-confirmed")[:10]
        )

        team_stats = [
            {
                "id": u.id,
                "name": u.get_full_name() or u.username,
                "role": u.role,
                "lead_count": u.lead_count,
                "confirmed": u.confirmed,
            }
            for u in team
        ]

        disposition = all_leads.values("status").annotate(count=Count("id")).order_by("-count")

        today = date.today()
        visits_qs = (
            LeadVisit.objects.filter(status=LeadVisit.Status.SCHEDULED, scheduled_date__gte=today)
            .select_related("lead", "assigned_to", "lead__merchant", "lead__project")
            .order_by("scheduled_date")
        )
        sub_qs = FormSubmission.objects.select_related("lead", "submitted_by", "custom_form").order_by("-submitted_at")
        if project_filter:
            visits_qs = visits_qs.filter(lead__project_id=project_filter)
            sub_qs = sub_qs.filter(custom_form__project_id=project_filter)
        product_filter = request.query_params.get("product")
        if product_filter:
            visits_qs = visits_qs.filter(lead__product_id=product_filter)
            sub_qs = sub_qs.filter(lead__product_id=product_filter)
        company_filter = request.query_params.get("company")
        if company_filter:
            visits_qs = visits_qs.filter(lead__merchant_id=company_filter)
            sub_qs = sub_qs.filter(lead__merchant_id=company_filter)

        project_name = None
        if project_filter:
            project_name = Project.objects.filter(id=project_filter).values_list("name", flat=True).first()

        payload = {
            "total_projects": projects.count(),
            "active_projects": projects.filter(is_active=True).count(),
            "total_companies": total_companies,
            "total_products": products_qs.filter(is_active=True).count(),
            "total_leads": total_leads,
            "orders_confirmed": confirmed,
            "follow_ups_due_today": due_today,
            "overdue_follow_ups": overdue,
            "conversion_rate": round((confirmed / total_leads * 100) if total_leads else 0, 1),
            "total_bdm": User.objects.filter(role=User.Role.BDM).count(),
            "total_tl": User.objects.filter(role=User.Role.TL).count(),
            "project_stats": project_stats,
            "company_stats": company_stats,
            "product_stats": product_stats,
            "team_stats": team_stats,
            "disposition": list(disposition),
            "forms_filled_today": sub_qs.filter(submitted_at__date=today).count(),
            "visits_scheduled_today": visits_qs.filter(scheduled_date=today).count(),
            "upcoming_team_visits": LeadVisitSerializer(visits_qs[:12], many=True).data,
            "recent_submissions": FormSubmissionSerializer(sub_qs[:8], many=True).data,
            "filter_summary": {
                "project_id": int(project_filter) if project_filter else None,
                "project_name": project_name,
                "product_id": int(product_filter) if product_filter else None,
                "company_id": int(company_filter) if company_filter else None,
                "manager_id": int(request.query_params.get("manager")) if request.query_params.get("manager") else None,
                "from": request.query_params.get("from"),
                "to": request.query_params.get("to"),
            },
        }
        return Response(payload)


class AdminExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_admin(request.user):
            raise PermissionDenied("Only Admin can export reports.")
        from .exports import export_admin_report_pdf, export_admin_report_xlsx

        response = AdminDashboardView().get(request)
        stamp = date.today().isoformat()
        project = request.query_params.get("project") or "all"
        fmt = (request.query_params.get("format") or "xlsx").lower()
        if fmt == "pdf":
            return export_admin_report_pdf(response.data, filename=f"crm_report_{project}_{stamp}.pdf")
        return export_admin_report_xlsx(response.data, filename=f"crm_report_{project}_{stamp}.xlsx")


class AdminDigestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_admin(request.user):
            raise PermissionDenied("Only Admin can trigger digests.")
        from .digest import send_daily_digest

        username = request.data.get("username")
        user_id = None
        if username:
            target = User.objects.filter(username=username).first()
            if not target:
                return Response({"detail": f"User not found: {username}"}, status=status.HTTP_404_NOT_FOUND)
            user_id = target.id

        # Run inline so local/dev works without Redis/Celery worker.
        # Celery beat still schedules send_daily_digest_task for production.
        result = send_daily_digest(user_id=user_id)
        return Response(result)


class FollowUpsHubView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        closed = [Lead.Status.ORDER_CONFIRMED, Lead.Status.NOT_INTERESTED]
        base = filter_by_project(
            request,
            leads_for_user(request.user)
            .select_related("merchant", "bdm", "project", "product")
            .exclude(status__in=closed)
            .exclude(follow_up_date__isnull=True),
        )
        overdue_qs = base.filter(follow_up_date__lt=today).order_by("follow_up_date")
        due_today_qs = base.filter(follow_up_date=today).order_by("merchant__name")
        upcoming_qs = base.filter(
            follow_up_date__gt=today,
            follow_up_date__lte=today + timedelta(days=7),
        ).order_by("follow_up_date")

        return Response({
            "counts": {
                "overdue": overdue_qs.count(),
                "due_today": due_today_qs.count(),
                "upcoming": upcoming_qs.count(),
            },
            "overdue": LeadSerializer(overdue_qs[:100], many=True).data,
            "due_today": LeadSerializer(due_today_qs[:100], many=True).data,
            "upcoming": LeadSerializer(upcoming_qs[:100], many=True).data,
        })


class AlertsHubView(APIView):
    """Actionable ops alerts scoped to the user's leads and team."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        closed = [Lead.Status.ORDER_CONFIRMED, Lead.Status.NOT_INTERESTED]
        user = request.user
        leads_qs = filter_by_project(request, leads_for_user(user))
        base = (
            leads_qs.select_related("merchant", "bdm", "project", "product")
            .exclude(status__in=closed)
            .exclude(follow_up_date__isnull=True)
        )
        overdue_qs = base.filter(follow_up_date__lt=today).order_by("follow_up_date")
        due_today_qs = base.filter(follow_up_date=today).order_by("merchant__name")

        pending_docs_qs = (
            LeadDocument.objects.filter(
                lead__in=leads_qs,
                verification_status=LeadDocument.VerificationStatus.PENDING,
            )
            .filter(
                Q(gst_file__isnull=False)
                | Q(pan_file__isnull=False)
                | Q(cheque_file__isnull=False)
            )
            .exclude(gst_file="", pan_file="", cheque_file="")
            .select_related("lead", "lead__merchant", "lead__bdm", "lead__project")
            .order_by("-uploaded_at")
        )

        visit_scope = visits_for_user(user)
        project_id = request.query_params.get("project")
        if project_id:
            visit_scope = visit_scope.filter(lead__project_id=project_id)
        missed_visits_qs = (
            visit_scope.filter(
                Q(status=LeadVisit.Status.MISSED)
                | Q(status=LeadVisit.Status.SCHEDULED, scheduled_date__lt=today),
                scheduled_date__gte=today - timedelta(days=14),
            )
            .select_related("lead", "lead__merchant", "lead__project", "assigned_to")
            .order_by("scheduled_date")
        )

        duplicate_groups = (
            leads_qs.values("merchant_id")
            .annotate(c=Count("id"))
            .filter(c__gt=1)
            .count()
        )

        visible_ids = list(users_for_user(user).values_list("id", flat=True))
        target_qs = SalesTarget.objects.filter(
            year=today.year,
            month=today.month,
            user_id__in=visible_ids,
            target_confirmed__gt=0,
        ).select_related("user", "project")
        if project_id:
            target_qs = target_qs.filter(Q(project_id=project_id) | Q(project__isnull=True))

        targets_at_risk = []
        for t in target_qs:
            month_leads = Lead.objects.filter(
                bdm=t.user,
                created_at__year=t.year,
                created_at__month=t.month,
            )
            if t.project_id:
                month_leads = month_leads.filter(project_id=t.project_id)
            actual_c = month_leads.filter(status=Lead.Status.ORDER_CONFIRMED).count()
            pct = round((actual_c / t.target_confirmed * 100) if t.target_confirmed else 0, 1)
            if today.day >= 10 and pct < 50:
                targets_at_risk.append({
                    "user_id": t.user_id,
                    "user_name": t.user.get_full_name() or t.user.username,
                    "project_name": t.project.name if t.project_id else "All projects",
                    "target_confirmed": t.target_confirmed,
                    "actual_confirmed": actual_c,
                    "confirmed_pct": pct,
                })
        targets_at_risk.sort(key=lambda r: r["confirmed_pct"])

        team_overdue = []
        if user.role != User.Role.BDM:
            team_overdue = [
                {
                    "bdm_id": row["bdm_id"],
                    "name": row["bdm__first_name"] or row["bdm__username"],
                    "username": row["bdm__username"],
                    "overdue": row["overdue"],
                }
                for row in overdue_qs.values("bdm_id", "bdm__first_name", "bdm__username")
                .annotate(overdue=Count("id"))
                .order_by("-overdue")[:15]
            ]

        pending_documents = [
            {
                "id": doc.id,
                "lead_id": doc.lead_id,
                "merchant_name": doc.lead.merchant.name,
                "project_name": doc.lead.project.name,
                "bdm_name": doc.lead.bdm.get_full_name() or doc.lead.bdm.username,
                "uploaded_at": doc.uploaded_at.isoformat(),
            }
            for doc in pending_docs_qs[:50]
        ]

        return Response({
            "counts": {
                "overdue_follow_ups": overdue_qs.count(),
                "due_today": due_today_qs.count(),
                "pending_documents": pending_docs_qs.count(),
                "missed_visits": missed_visits_qs.count(),
                "targets_at_risk": len(targets_at_risk),
                "duplicate_groups": duplicate_groups,
            },
            "team_overdue": team_overdue,
            "overdue_follow_ups": LeadSerializer(overdue_qs[:30], many=True).data,
            "due_today": LeadSerializer(due_today_qs[:30], many=True).data,
            "pending_documents": pending_documents,
            "missed_visits": LeadVisitSerializer(missed_visits_qs[:30], many=True).data,
            "targets_at_risk": targets_at_risk[:20],
        })


class PerformanceReportView(APIView):
    """BDM leaderboard, disposition and weekly trend for the visible hierarchy."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = dashboard_filter_leads(request, leads_for_user(request.user))
        team_id = request.query_params.get("team")
        bdm_id = request.query_params.get("bdm")
        if team_id:
            team = Team.objects.filter(id=team_id).prefetch_related("members").first()
            if team:
                member_ids = list(team.members.values_list("id", flat=True))
                qs = qs.filter(bdm_id__in=member_ids)
        if bdm_id:
            qs = qs.filter(bdm_id=bdm_id)

        total = qs.count()
        confirmed = qs.filter(status=Lead.Status.ORDER_CONFIRMED).count()
        due_today = qs.filter(follow_up_date=date.today()).count()
        overdue = qs.filter(follow_up_date__lt=date.today()).exclude(
            status__in=[Lead.Status.ORDER_CONFIRMED, Lead.Status.NOT_INTERESTED]
        ).count()
        conversion = round((confirmed / total * 100) if total else 0, 1)
        disposition = list(qs.values("status").annotate(count=Count("id")).order_by("-count"))

        bdm_rows = (
            qs.values("bdm_id", "bdm__first_name", "bdm__username", "bdm__role")
            .annotate(
                lead_count=Count("id"),
                confirmed=Count("id", filter=Q(status=Lead.Status.ORDER_CONFIRMED)),
                follow_ups_today=Count("id", filter=Q(follow_up_date=date.today())),
                overdue=Count(
                    "id",
                    filter=Q(follow_up_date__lt=date.today())
                    & ~Q(status__in=[Lead.Status.ORDER_CONFIRMED, Lead.Status.NOT_INTERESTED]),
                ),
            )
            .order_by("-confirmed", "-lead_count")
        )
        bdm_stats = [
            {
                "id": row["bdm_id"],
                "name": row["bdm__first_name"] or row["bdm__username"],
                "username": row["bdm__username"],
                "role": row["bdm__role"],
                "lead_count": row["lead_count"],
                "confirmed": row["confirmed"],
                "conversion": round((row["confirmed"] / row["lead_count"] * 100) if row["lead_count"] else 0, 1),
                "follow_ups_today": row["follow_ups_today"],
                "overdue": row["overdue"],
            }
            for row in bdm_rows
        ]

        # Attach current-month sales targets (project-scoped when filter set)
        today = date.today()
        project_id = request.query_params.get("project")
        target_qs = SalesTarget.objects.filter(year=today.year, month=today.month)
        if project_id:
            target_qs = target_qs.filter(Q(project_id=project_id) | Q(project__isnull=True))
        else:
            target_qs = target_qs.filter(project__isnull=True)
        targets_by_user = {t.user_id: t for t in target_qs}
        month_qs = qs.filter(
            created_at__year=today.year,
            created_at__month=today.month,
        )
        month_by_bdm = {
            row["bdm_id"]: row
            for row in month_qs.values("bdm_id").annotate(
                lead_count=Count("id"),
                confirmed=Count("id", filter=Q(status=Lead.Status.ORDER_CONFIRMED)),
            )
        }
        for row in bdm_stats:
            t = targets_by_user.get(row["id"])
            m = month_by_bdm.get(row["id"], {})
            actual_c = m.get("confirmed", 0)
            actual_l = m.get("lead_count", 0)
            if t:
                row["target_confirmed"] = t.target_confirmed
                row["target_leads"] = t.target_leads
                row["actual_confirmed"] = actual_c
                row["actual_leads"] = actual_l
                row["confirmed_pct"] = round(
                    (actual_c / t.target_confirmed * 100) if t.target_confirmed else 0, 1
                )
                row["leads_pct"] = round(
                    (actual_l / t.target_leads * 100) if t.target_leads else 0, 1
                )
            else:
                row["target_confirmed"] = None
                row["target_leads"] = None
                row["actual_confirmed"] = actual_c
                row["actual_leads"] = actual_l
                row["confirmed_pct"] = None
                row["leads_pct"] = None

        trend_start = date.today() - timedelta(weeks=8)
        weekly_trend = [
            {
                "week": row["week"].date().isoformat() if row["week"] else None,
                "leads": row["leads"],
                "confirmed": row["confirmed"],
            }
            for row in qs.filter(created_at__date__gte=trend_start)
            .annotate(week=TruncWeek("created_at"))
            .values("week")
            .annotate(
                leads=Count("id"),
                confirmed=Count("id", filter=Q(status=Lead.Status.ORDER_CONFIRMED)),
            )
            .order_by("week")
        ]

        product_rows = (
            qs.exclude(product_id__isnull=True)
            .values("product_id", "product__name")
            .annotate(
                lead_count=Count("id"),
                confirmed_count=Count("id", filter=Q(status=Lead.Status.ORDER_CONFIRMED)),
            )
            .order_by("-lead_count")[:10]
        )
        top_products = [
            {
                "id": row["product_id"],
                "name": row["product__name"],
                "lead_count": row["lead_count"],
                "confirmed_count": row["confirmed_count"],
                "conversion": round(
                    (row["confirmed_count"] / row["lead_count"] * 100) if row["lead_count"] else 0, 1
                ),
            }
            for row in product_rows
        ]

        return Response({
            "summary": {
                "total_leads": total,
                "orders_confirmed": confirmed,
                "conversion_rate": conversion,
                "follow_ups_due_today": due_today,
                "overdue_follow_ups": overdue,
            },
            "disposition": disposition,
            "bdm_stats": bdm_stats,
            "weekly_trend": weekly_trend,
            "top_products": top_products,
        })


class SalesTargetViewSet(viewsets.ModelViewSet):
    queryset = SalesTarget.objects.select_related("user", "project", "created_by")
    serializer_class = SalesTargetSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == User.Role.BDM:
            qs = qs.filter(user=user)
        else:
            visible = users_for_user(user).values_list("id", flat=True)
            qs = qs.filter(user_id__in=visible)
        year = self.request.query_params.get("year")
        month = self.request.query_params.get("month")
        project = self.request.query_params.get("project")
        bdm = self.request.query_params.get("user") or self.request.query_params.get("bdm")
        if year:
            qs = qs.filter(year=year)
        if month:
            qs = qs.filter(month=month)
        if project == "null" or project == "":
            qs = qs.filter(project__isnull=True)
        elif project:
            qs = qs.filter(Q(project_id=project) | Q(project__isnull=True))
        if bdm:
            qs = qs.filter(user_id=bdm)
        return qs.order_by("-year", "-month", "user__first_name")

    def _can_manage(self):
        return self.request.user.role in (User.Role.ADMIN, User.Role.MANAGER, User.Role.TL)

    def perform_create(self, serializer):
        if not self._can_manage():
            raise PermissionDenied("Only Admin, Manager or TL can set targets.")
        target_user = serializer.validated_data["user"]
        actor = self.request.user
        if actor.role != User.Role.ADMIN:
            allowed = {actor.id} | get_descendant_ids(actor)
            if target_user.id not in allowed:
                raise PermissionDenied("Cannot set target for this user.")
        serializer.save(created_by=actor)

    def perform_update(self, serializer):
        if not self._can_manage():
            raise PermissionDenied("Only Admin, Manager or TL can edit targets.")
        serializer.save()

    def perform_destroy(self, instance):
        if not self._can_manage():
            raise PermissionDenied("Only Admin, Manager or TL can delete targets.")
        instance.delete()

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        data = []
        for t in qs:
            month_leads = Lead.objects.filter(
                bdm=t.user,
                created_at__year=t.year,
                created_at__month=t.month,
            )
            if t.project_id:
                month_leads = month_leads.filter(project_id=t.project_id)
            actual_l = month_leads.count()
            actual_c = month_leads.filter(status=Lead.Status.ORDER_CONFIRMED).count()
            row = SalesTargetSerializer(t).data
            row["actual_leads"] = actual_l
            row["actual_confirmed"] = actual_c
            row["confirmed_pct"] = round(
                (actual_c / t.target_confirmed * 100) if t.target_confirmed else 0, 1
            )
            row["leads_pct"] = round(
                (actual_l / t.target_leads * 100) if t.target_leads else 0, 1
            )
            data.append(row)
        return Response(data)


class MerchantViewSet(viewsets.ModelViewSet):
    queryset = Merchant.objects.all().order_by("-created_at")
    serializer_class = MerchantSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return filter_by_project(self.request, super().get_queryset())


class LeadViewSet(viewsets.ModelViewSet):
    queryset = Lead.objects.all()
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = filter_by_project(
            self.request,
            leads_for_user(self.request.user).select_related("merchant", "bdm", "project", "product").prefetch_related("documents"),
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if self.request.query_params.get("overdue") == "1":
            qs = qs.filter(follow_up_date__lt=date.today()).exclude(
                status__in=[Lead.Status.ORDER_CONFIRMED, Lead.Status.NOT_INTERESTED]
            )
        if self.request.query_params.get("due_today") == "1":
            qs = qs.filter(follow_up_date=date.today()).exclude(
                status__in=[Lead.Status.ORDER_CONFIRMED, Lead.Status.NOT_INTERESTED]
            )
        product_id = self.request.query_params.get("product")
        if product_id:
            qs = qs.filter(product_id=product_id)
        company_id = self.request.query_params.get("company")
        if company_id:
            qs = qs.filter(merchant_id=company_id)
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(merchant__name__icontains=q)
                | Q(merchant__mobile__icontains=q)
                | Q(merchant__city__icontains=q)
                | Q(merchant__brand_name__icontains=q)
                | Q(notes__icontains=q)
                | Q(product__name__icontains=q)
            )
        return qs.order_by("-updated_at")

    @action(detail=False, methods=["get"])
    def export(self, request):
        from .exports import export_leads_pdf, export_leads_xlsx

        qs = list(self.get_queryset()[:5000])
        project = request.query_params.get("project")
        stamp = date.today().isoformat()
        fmt = (request.query_params.get("format") or "xlsx").lower()
        if fmt == "pdf":
            return export_leads_pdf(qs, filename=f"leads_{project or 'all'}_{stamp}.pdf")
        return export_leads_xlsx(qs, filename=f"leads_{project or 'all'}_{stamp}.xlsx")

    @action(detail=False, methods=["get"])
    def pipeline(self, request):
        """Board data: leads grouped by status (capped for UI)."""
        qs = self.get_queryset()[:400]
        columns = {key: [] for key, _ in Lead.Status.choices}
        for lead in qs:
            columns.setdefault(lead.status, []).append(LeadSerializer(lead).data)
        counts = {k: len(v) for k, v in columns.items()}
        return Response({"columns": columns, "counts": counts, "total": sum(counts.values())})

    @action(detail=False, methods=["get"], url_path="check-duplicate")
    def check_duplicate(self, request):
        mobile = (request.query_params.get("mobile") or "").strip()
        project_id = request.query_params.get("project") or request.query_params.get("project_id")
        exclude = request.query_params.get("exclude_lead")
        if not mobile or not project_id:
            return Response({"detail": "mobile and project are required."}, status=status.HTTP_400_BAD_REQUEST)
        matches = find_duplicate_leads(
            request.user,
            int(project_id),
            mobile,
            exclude_lead_id=int(exclude) if exclude else None,
        )
        return Response({
            "duplicate": len(matches) > 0,
            "count": len(matches),
            "leads": LeadSerializer(matches, many=True).data,
        })

    @action(detail=False, methods=["get"])
    def duplicates(self, request):
        qs = filter_by_project(request, leads_for_user(request.user))
        dup_ids = (
            qs.values("merchant_id")
            .annotate(c=Count("id"))
            .filter(c__gt=1)
            .values_list("merchant_id", flat=True)
        )
        leads = (
            qs.filter(merchant_id__in=dup_ids)
            .select_related("merchant", "bdm", "product", "project")
            .order_by("merchant__name", "-updated_at")
        )
        groups: dict[int, dict] = {}
        for lead in leads:
            g = groups.setdefault(
                lead.merchant_id,
                {
                    "merchant_id": lead.merchant_id,
                    "merchant_name": lead.merchant.name,
                    "mobile": lead.merchant.mobile,
                    "project_id": lead.project_id,
                    "project_name": lead.project.name,
                    "lead_count": 0,
                    "leads": [],
                },
            )
            g["lead_count"] += 1
            g["leads"].append(LeadSerializer(lead).data)
        group_list = sorted(groups.values(), key=lambda g: (-g["lead_count"], g["merchant_name"]))
        return Response({
            "count": len(group_list),
            "duplicate_leads": sum(g["lead_count"] for g in group_list),
            "groups": group_list,
        })


    def get_serializer_class(self):
        if self.action == "create":
            return LeadCreateSerializer
        if self.action in ("update", "partial_update"):
            return LeadUpdateSerializer
        return LeadSerializer

    def create(self, request, *args, **kwargs):
        serializer = LeadCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        if not request.data.get("force"):
            project = serializer.validated_data["project"]
            mobile = serializer.validated_data["merchant_mobile"]
            matches = find_duplicate_leads(request.user, project.id, mobile)
            if matches:
                return Response(
                    {
                        "detail": "A lead with this mobile already exists in this project.",
                        "duplicate": True,
                        "leads": LeadSerializer(matches, many=True).data,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
        lead = serializer.save()
        return Response(LeadSerializer(lead).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = LeadUpdateSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        lead = serializer.save()
        return Response(LeadSerializer(lead).data)

    def perform_create(self, serializer):
        bdm = serializer.validated_data.get("bdm") or self.request.user
        serializer.save(bdm=bdm)

    @action(detail=True, methods=["patch"])
    def follow_up(self, request, pk=None):
        lead = self.get_object()
        lead.status = Lead.Status.FOLLOW_UP
        if "follow_up_date" in request.data:
            lead.follow_up_date = request.data["follow_up_date"]
        if "notes" in request.data:
            note = request.data["notes"]
            lead.notes = f"{lead.notes}\n[{date.today()}] {note}".strip() if lead.notes else f"[{date.today()}] {note}"
        lead.save()
        return Response(LeadSerializer(lead).data)

    @action(detail=True, methods=["post"], url_path="log-call")
    def log_call(self, request, pk=None):
        lead = self.get_object()
        outcome = (request.data.get("outcome") or "").strip()
        note = (request.data.get("notes") or "").strip()
        labels = {
            "answered": "Answered",
            "no_answer": "No answer",
            "busy": "Busy",
            "callback": "Callback requested",
            "interested": "Interested",
            "not_interested": "Not interested",
        }
        if outcome not in labels:
            return Response({"detail": "Invalid outcome."}, status=status.HTTP_400_BAD_REQUEST)

        actor = request.user.get_full_name() or request.user.username
        stamp = f"[{date.today()}] Call ({labels[outcome]})"
        if note:
            stamp = f"{stamp}: {note}"
        lead.notes = f"{lead.notes}\n{stamp}".strip() if lead.notes else stamp

        if outcome == "callback":
            lead.status = Lead.Status.CALLBACK
        elif outcome == "interested":
            lead.status = Lead.Status.INTERESTED
        elif outcome == "not_interested":
            lead.status = Lead.Status.NOT_INTERESTED
        elif outcome in ("no_answer", "busy"):
            lead.status = Lead.Status.FOLLOW_UP

        if request.data.get("follow_up_date"):
            lead.follow_up_date = request.data["follow_up_date"]

        lead.save()

        from .audit import log_audit

        log_audit(
            request.user,
            action="lead.call_logged",
            entity_type="Lead",
            entity_id=lead.id,
            message=f"Call logged for {lead.merchant.name}: {labels[outcome]}",
            meta={"outcome": outcome, "actor": actor},
        )
        return Response(LeadSerializer(lead).data)

    @action(detail=True, methods=["patch"])
    def reassign(self, request, pk=None):
        if not can_reassign_leads(request.user):
            raise PermissionDenied("Only Admin, Manager or TL can reassign leads.")
        lead = self.get_object()
        bdm_id = request.data.get("bdm")
        if not bdm_id:
            return Response({"detail": "bdm is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            new_bdm = User.objects.get(id=bdm_id, is_active_user=True)
        except User.DoesNotExist:
            return Response({"detail": "Target user not found."}, status=status.HTTP_404_NOT_FOUND)
        if not can_reassign_to(request.user, new_bdm):
            raise PermissionDenied("Cannot reassign to this user.")
        if new_bdm.id == lead.bdm_id:
            return Response({"detail": "Lead is already assigned to this user."}, status=status.HTTP_400_BAD_REQUEST)

        old_bdm = lead.bdm
        old_name = old_bdm.get_full_name() or old_bdm.username
        new_name = new_bdm.get_full_name() or new_bdm.username
        note = (request.data.get("notes") or "").strip()
        lead.bdm = new_bdm
        stamp = f"[{date.today()}] Reassigned from {old_name} to {new_name}"
        if note:
            stamp = f"{stamp}: {note}"
        lead.notes = f"{lead.notes}\n{stamp}".strip() if lead.notes else stamp
        lead.save(update_fields=["bdm", "notes", "updated_at"])

        from .audit import log_audit
        from .models import Notification

        log_audit(
            request.user,
            action="lead.reassigned",
            entity_type="Lead",
            entity_id=lead.id,
            message=f"Lead {lead.merchant.name} reassigned {old_name} → {new_name}",
            meta={"from_bdm": old_bdm.id, "to_bdm": new_bdm.id},
        )
        Notification.objects.create(
            user=new_bdm,
            message=f"Lead assigned to you: {lead.merchant.name}",
            link=f"/leads?lead={lead.id}",
        )
        if old_bdm.id != request.user.id:
            Notification.objects.create(
                user=old_bdm,
                message=f"Lead reassigned away: {lead.merchant.name} → {new_name}",
                link=f"/leads?lead={lead.id}",
            )
        return Response(LeadSerializer(lead).data)

    @action(detail=True, methods=["post"])
    def merge(self, request, pk=None):
        if not can_reassign_leads(request.user):
            raise PermissionDenied("Only Admin, Manager or TL can merge leads.")
        primary = self.get_object()
        source_ids = request.data.get("source_ids") or []
        if not source_ids:
            return Response({"detail": "source_ids is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(source_ids, list):
            return Response({"detail": "source_ids must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        sources = list(
            leads_for_user(request.user)
            .filter(id__in=source_ids)
            .exclude(id=primary.id)
            .select_related("merchant", "bdm", "product")
        )
        if len(sources) != len(set(source_ids)):
            raise PermissionDenied("Cannot merge one or more leads.")

        merged_ids = []
        with transaction.atomic():
            for src in sources:
                if src.merchant_id != primary.merchant_id or src.project_id != primary.project_id:
                    return Response(
                        {"detail": "All leads must belong to the same merchant and project."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                merged_ids.append(src.id)
                if src.notes:
                    bdm_label = src.bdm.get_full_name() or src.bdm.username
                    stamp = f"[{date.today()}] Merged from lead #{src.id} ({bdm_label})"
                    block = f"{stamp}\n{src.notes}"
                    primary.notes = f"{primary.notes}\n{block}".strip() if primary.notes else block
                merged_custom = dict(primary.custom_data or {})
                for key, val in (src.custom_data or {}).items():
                    if key not in merged_custom or merged_custom[key] in (None, "", []):
                        merged_custom[key] = val
                primary.custom_data = merged_custom
                if not primary.product_id and src.product_id:
                    primary.product = src.product
                if not primary.follow_up_date and src.follow_up_date:
                    primary.follow_up_date = src.follow_up_date
                elif src.follow_up_date and primary.follow_up_date and src.follow_up_date < primary.follow_up_date:
                    primary.follow_up_date = src.follow_up_date

                FormSubmission.objects.filter(lead=src).update(lead=primary)
                LeadVisit.objects.filter(lead=src).update(lead=primary)

                src_doc = LeadDocument.objects.filter(lead=src).first()
                if src_doc:
                    pri_doc, _ = LeadDocument.objects.get_or_create(lead=primary)
                    doc_changed = False
                    for field in ("gst_file", "pan_file", "cheque_file"):
                        if not getattr(pri_doc, field) and getattr(src_doc, field):
                            setattr(pri_doc, field, getattr(src_doc, field))
                            doc_changed = True
                    if doc_changed:
                        pri_doc.save()

                src.delete()

            primary.save()

        from .audit import log_audit

        log_audit(
            request.user,
            action="lead.merged",
            entity_type="Lead",
            entity_id=primary.id,
            message=f"Merged {len(merged_ids)} duplicate lead(s) into #{primary.id} ({primary.merchant.name})",
            meta={"primary_id": primary.id, "merged_ids": merged_ids},
        )
        return Response(LeadSerializer(primary).data)

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def upload_documents(self, request, pk=None):
        lead = self.get_object()
        doc, _ = LeadDocument.objects.get_or_create(lead=lead)
        changed = False
        for field in ("gst_file", "pan_file", "cheque_file"):
            if field in request.FILES:
                setattr(doc, field, request.FILES[field])
                changed = True
        if changed:
            doc.verification_status = LeadDocument.VerificationStatus.PENDING
            doc.verified_by = None
        doc.save()
        return Response(LeadDocumentSerializer(doc, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="download-document")
    def download_document(self, request, pk=None):
        field = request.query_params.get("field")
        if field not in ("gst_file", "pan_file", "cheque_file"):
            return Response({"detail": "Invalid field."}, status=status.HTTP_400_BAD_REQUEST)
        lead = self.get_object()
        doc = LeadDocument.objects.filter(lead=lead).first()
        if not doc:
            return Response({"detail": "No documents."}, status=status.HTTP_404_NOT_FOUND)
        f = getattr(doc, field)
        if not f:
            return Response({"detail": "File not uploaded."}, status=status.HTTP_404_NOT_FOUND)
        filename = os.path.basename(f.name)
        return FileResponse(f.open("rb"), as_attachment=True, filename=filename)

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser], url_path="upload-form-file")
    def upload_form_file(self, request, pk=None):
        lead = self.get_object()
        field_id = request.data.get("field_id")
        upload = request.FILES.get("file")
        if not field_id or not upload:
            return Response({"detail": "field_id and file are required."}, status=status.HTTP_400_BAD_REQUEST)
        form = CustomForm.objects.filter(project=lead.project, is_active=True).first()
        if not form:
            return Response({"detail": "No custom form for this project."}, status=status.HTTP_404_NOT_FOUND)
        field_def = next((f for f in (form.schema or []) if f.get("field_id") == field_id), None)
        if not field_def or field_def.get("type") != "file":
            return Response({"detail": "Invalid file field."}, status=status.HTTP_400_BAD_REQUEST)
        max_mb = float(field_def.get("max_file_mb") or 10)
        if upload.size > max_mb * 1024 * 1024:
            return Response({"detail": f"File must be under {max_mb}MB."}, status=status.HTTP_400_BAD_REQUEST)
        ext_errors = validate_form_answers(form.schema, {field_id: upload.name})
        if ext_errors:
            return Response({"detail": ext_errors}, status=status.HTTP_400_BAD_REQUEST)
        safe_name = os.path.basename(upload.name)
        path = default_storage.save(
            f"form_uploads/{lead.project_id}/{lead.id}/{field_id}/{safe_name}",
            upload,
        )
        url = default_storage.url(path)
        if not url.startswith("http"):
            url = request.build_absolute_uri(url)
        return Response({"url": url, "name": safe_name, "path": path})

    @action(detail=True, methods=["patch"])
    def verify_documents(self, request, pk=None):
        lead = self.get_object()
        if request.user.role not in (User.Role.ADMIN, User.Role.TL, User.Role.MANAGER):
            return Response({"detail": "Only TL/Manager/Admin can verify."}, status=status.HTTP_403_FORBIDDEN)
        doc, _ = LeadDocument.objects.get_or_create(lead=lead)
        doc.verification_status = request.data.get("verification_status", doc.verification_status)
        doc.verified_by = request.user
        doc.save()
        return Response(LeadDocumentSerializer(doc, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def activity(self, request, pk=None):
        lead = self.get_object()
        events = []

        events.append({
            "id": f"lead-{lead.id}",
            "type": "lead_created",
            "title": "Lead created",
            "detail": f"{lead.merchant.name} · {lead.get_status_display()}",
            "actor": lead.bdm.get_full_name() or lead.bdm.username,
            "at": lead.created_at.isoformat(),
        })

        for visit in LeadVisit.objects.filter(lead=lead).select_related("assigned_to", "assigned_by").order_by("-created_at"):
            events.append({
                "id": f"visit-{visit.id}",
                "type": "visit",
                "title": f"Visit {visit.get_status_display().lower()}",
                "detail": f"{visit.get_visit_type_display()} · {visit.scheduled_date}"
                + (f" · {visit.remarks}" if visit.remarks else ""),
                "actor": visit.assigned_to.get_full_name() or visit.assigned_to.username,
                "at": (visit.completed_at or visit.created_at).isoformat(),
                "meta": {"status": visit.status, "scheduled_date": str(visit.scheduled_date)},
            })

        for sub in FormSubmission.objects.filter(lead=lead).select_related("submitted_by", "custom_form").order_by("-submitted_at"):
            events.append({
                "id": f"form-{sub.id}",
                "type": "form",
                "title": "Form submitted",
                "detail": sub.custom_form.title if sub.custom_form_id else "Custom form",
                "actor": sub.submitted_by.get_full_name() or sub.submitted_by.username,
                "at": sub.submitted_at.isoformat(),
            })

        for doc in LeadDocument.objects.filter(lead=lead).select_related("verified_by").order_by("-uploaded_at"):
            files = [label for label, field in (("GST", doc.gst_file), ("PAN", doc.pan_file), ("Cheque", doc.cheque_file)) if field]
            events.append({
                "id": f"doc-{doc.id}",
                "type": "document",
                "title": f"Documents {doc.get_verification_status_display().lower()}",
                "detail": (", ".join(files) if files else "No files") + (
                    f" · verified by {doc.verified_by.get_full_name() or doc.verified_by.username}"
                    if doc.verified_by_id else ""
                ),
                "actor": (
                    (doc.verified_by.get_full_name() or doc.verified_by.username)
                    if doc.verified_by_id else "Team"
                ),
                "at": doc.uploaded_at.isoformat(),
                "meta": {"verification_status": doc.verification_status},
            })

        import re
        note_pat = re.compile(r"^\[(\d{4}-\d{2}-\d{2})\]\s*(.*)$")
        call_pat = re.compile(r"^\[(\d{4}-\d{2}-\d{2})\]\s*Call \(([^)]+)\)(?::\s*(.*))?$")
        if lead.notes:
            for line in lead.notes.splitlines():
                line = line.strip()
                if not line:
                    continue
                call_m = call_pat.match(line)
                if call_m:
                    events.append({
                        "id": f"call-{call_m.group(1)}-{abs(hash(line)) % 10_000}",
                        "type": "call",
                        "title": f"Call · {call_m.group(2)}",
                        "detail": call_m.group(3) or "Phone contact logged",
                        "actor": lead.bdm.get_full_name() or lead.bdm.username,
                        "at": f"{call_m.group(1)}T12:00:00",
                        "meta": {"outcome": call_m.group(2)},
                    })
                    continue
                m = note_pat.match(line)
                if m and line.startswith(f"[{m.group(1)}] Call"):
                    continue
                if m:
                    events.append({
                        "id": f"note-{m.group(1)}-{abs(hash(line)) % 10_000}",
                        "type": "note",
                        "title": "Follow-up note",
                        "detail": m.group(2),
                        "actor": lead.bdm.get_full_name() or lead.bdm.username,
                        "at": f"{m.group(1)}T12:00:00",
                    })
                else:
                    events.append({
                        "id": f"note-raw-{abs(hash(line)) % 10_000}",
                        "type": "note",
                        "title": "Note",
                        "detail": line,
                        "actor": lead.bdm.get_full_name() or lead.bdm.username,
                        "at": lead.updated_at.isoformat(),
                    })

        events.sort(key=lambda e: e["at"], reverse=True)
        return Response({"lead_id": lead.id, "events": events})

    @action(detail=True, methods=["post"])
    def form_submission(self, request, pk=None):
        lead = self.get_object()
        form = CustomForm.objects.filter(project=lead.project, is_active=True).first()
        if not form:
            return Response({"detail": "No custom form for this project."}, status=status.HTTP_404_NOT_FOUND)
        answers = request.data.get("answers", {})
        errors = validate_form_answers(form.schema, answers)
        if errors:
            return Response({"detail": errors}, status=status.HTTP_400_BAD_REQUEST)
        lead.custom_data = answers
        lead.save(update_fields=["custom_data"])
        sub, _ = FormSubmission.objects.update_or_create(
            lead=lead, custom_form=form,
            defaults={"submitted_by": request.user, "answers": answers},
        )
        visit_id = request.data.get("visit_id")
        visit = None
        if visit_id:
            visit = LeadVisit.objects.filter(id=visit_id, lead=lead).first()
        if not visit:
            visit = (
                LeadVisit.objects.filter(
                    lead=lead, assigned_to=request.user, status=LeadVisit.Status.SCHEDULED
                )
                .order_by("scheduled_date")
                .first()
            )
        if visit:
            visit.status = LeadVisit.Status.COMPLETED
            visit.completed_at = timezone.now()
            visit.form_submission = sub
            if request.data.get("remarks"):
                visit.remarks = request.data["remarks"]
            visit.save()
        return Response(FormSubmissionSerializer(sub).data)


class VisitViewSet(viewsets.ModelViewSet):
    queryset = LeadVisit.objects.select_related("lead", "assigned_to", "assigned_by", "lead__merchant")
    serializer_class = LeadVisitSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = visits_for_user(self.request.user)
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(lead__project_id=project_id)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        upcoming = self.request.query_params.get("upcoming")
        if upcoming == "1":
            qs = qs.filter(status=LeadVisit.Status.SCHEDULED, scheduled_date__gte=date.today())
        date_from = self.request.query_params.get("from")
        date_to = self.request.query_params.get("to")
        if date_from:
            qs = qs.filter(scheduled_date__gte=date_from)
        if date_to:
            qs = qs.filter(scheduled_date__lte=date_to)
        return qs.order_by("scheduled_date")

    def perform_create(self, serializer):
        if not can_assign_visits(self.request.user):
            raise PermissionDenied("Only Admin/Manager/TL can assign visits.")
        lead = serializer.validated_data["lead"]
        if lead.id not in leads_for_user(self.request.user).values_list("id", flat=True) and not is_admin(self.request.user):
            raise PermissionDenied("Cannot assign visit for this lead.")
        assigned_to = serializer.validated_data.get("assigned_to") or lead.bdm
        serializer.save(assigned_by=self.request.user, assigned_to=assigned_to)

    @action(detail=True, methods=["patch"])
    def complete(self, request, pk=None):
        visit = self.get_object()
        visit.status = LeadVisit.Status.COMPLETED
        visit.completed_at = timezone.now()
        if "remarks" in request.data:
            visit.remarks = request.data["remarks"]
        visit.save()
        return Response(LeadVisitSerializer(visit).data)


class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.select_related("project", "manager").prefetch_related("members")
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = teams_for_user(self.request.user).select_related("project", "manager").prefetch_related("members")
        return filter_by_project(self.request, qs)

    def perform_update(self, serializer):
        if not can_manage_team(self.request.user):
            raise PermissionDenied("Only Admin, Manager or TL can update teams.")
        user = self.request.user
        if not is_admin(user):
            instance = self.get_object()
            if instance.manager_id != user.id:
                raise PermissionDenied("You can only edit teams you manage.")
            if "manager" in serializer.validated_data:
                serializer.validated_data.pop("manager")
        team = serializer.save()
        if "members" in serializer.validated_data:
            team.members.set(serializer.validated_data["members"])

    def perform_create(self, serializer):
        if not can_manage_team(self.request.user):
            raise PermissionDenied("Only Admin, Manager or TL can create teams.")
        manager = self.request.user
        if is_admin(self.request.user) and serializer.validated_data.get("manager"):
            manager = serializer.validated_data["manager"]
        members = serializer.validated_data.pop("members", [])
        team = serializer.save(manager=manager)
        if members:
            team.members.set(members)

    def perform_destroy(self, instance):
        if not can_manage_team(self.request.user):
            raise PermissionDenied("Only Admin, Manager or TL can delete teams.")
        if not is_admin(self.request.user) and instance.manager_id != self.request.user.id:
            raise PermissionDenied("You can only delete your own teams.")
        instance.delete()

    @action(detail=True, methods=["get"])
    def reporting(self, request, pk=None):
        team = self.get_object()
        member_ids = list(team.members.values_list("id", flat=True))
        leads = Lead.objects.filter(project=team.project, bdm_id__in=member_ids)
        total = leads.count()
        confirmed = leads.filter(status=Lead.Status.ORDER_CONFIRMED).count()
        leaderboard = (
            leads.values("bdm__first_name", "bdm__username")
            .annotate(total=Count("id"), confirmed=Count("id", filter=Q(status=Lead.Status.ORDER_CONFIRMED)))
            .order_by("-confirmed")
        )
        return Response({
            "team": TeamSerializer(team).data,
            "total_leads": total,
            "confirmed": confirmed,
            "conversion": round((confirmed / total * 100) if total else 0, 1),
            "leaderboard": list(leaderboard),
        })


class AdminManagersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_admin(request.user):
            raise PermissionDenied("Manager access only.")
        managers = User.objects.filter(role=User.Role.MANAGER).annotate(
            lead_count=Count("leads"),
            confirmed=Count("leads", filter=Q(leads__status=Lead.Status.ORDER_CONFIRMED)),
        )
        data = []
        for m in managers:
            team_leads = leads_for_user(m)
            data.append({
                "id": m.id,
                "name": m.get_full_name() or m.username,
                "role": m.role,
                "lead_count": team_leads.count(),
                "confirmed": team_leads.filter(status=Lead.Status.ORDER_CONFIRMED).count(),
                "follow_ups_today": team_leads.filter(follow_up_date=date.today()).count(),
            })
        return Response(data)


class ManagerDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in (User.Role.ADMIN, User.Role.MANAGER, User.Role.TL):
            raise PermissionDenied("Manager/TL only.")
        leads = filter_by_project(request, leads_for_user(request.user))
        team_id = request.query_params.get("team")
        if team_id:
            team = Team.objects.filter(id=team_id).prefetch_related("members").first()
            if team:
                member_ids = list(team.members.values_list("id", flat=True))
                leads = leads.filter(bdm_id__in=member_ids)
        return Response(DashboardView._stats(leads) | DashboardView._workdesk(request))


class ManagerDrilldownView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, manager_id):
        if not is_admin(request.user):
            raise PermissionDenied("Admin only.")
        manager = User.objects.get(id=manager_id)
        leads = filter_by_project(request, leads_for_user(manager))
        return Response({
            "manager": UserSerializer(manager).data,
            "stats": DashboardView._stats(leads),
        })


class BulkJobView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        job = BulkUploadJob.objects.get(id=job_id)
        if not is_admin(request.user) and job.uploaded_by_id != request.user.id:
            raise PermissionDenied("Not your upload job.")
        return Response(BulkUploadJobSerializer(job).data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_active_user=True).prefetch_related("assigned_projects")
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        if is_admin(self.request.user):
            # Admins need inactive users for edit/reactivate; list can filter with ?all=1
            if self.action in ("retrieve", "update", "partial_update", "destroy") or self.request.query_params.get("all") == "1":
                qs = User.objects.all().prefetch_related("assigned_projects")
            else:
                qs = User.objects.filter(is_active_user=True).prefetch_related("assigned_projects")
        else:
            qs = users_for_user(self.request.user).prefetch_related("assigned_projects")
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)
        return qs.order_by("role", "username")

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("update", "partial_update"):
            return UserUpdateSerializer
        return UserSerializer

    def perform_create(self, serializer):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only Admin can create users.")
        user = serializer.save()
        from .audit import log_audit
        log_audit(
            self.request.user,
            action="user.created",
            entity_type="User",
            entity_id=user.id,
            message=f"Admin created user {user.username} ({user.role})",
            meta={"role": user.role},
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(UserSerializer(serializer.instance).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        from .audit import log_audit
        log_audit(
            request.user,
            action="user.updated",
            entity_type="User",
            entity_id=instance.id,
            message=f"User updated: {instance.username}",
            meta={"role": instance.role, "is_active_user": instance.is_active_user},
        )
        return Response(UserSerializer(instance).data)

    def perform_update(self, serializer):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only Admin can edit users.")
        serializer.save()

    def perform_destroy(self, instance):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only Admin can deactivate users.")
        instance.is_active_user = False
        instance.is_active = False
        instance.save(update_fields=["is_active_user", "is_active"])
        from .audit import log_audit
        log_audit(
            self.request.user,
            action="user.deactivated",
            entity_type="User",
            entity_id=instance.id,
            message=f"User deactivated: {instance.username}",
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AuditLogListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_admin(request.user):
            raise PermissionDenied("Only Admin can view audit logs.")
        from .models import AuditLog
        from .serializers import AuditLogSerializer

        qs = AuditLog.objects.select_related("actor").all()
        action = request.query_params.get("action")
        entity_type = request.query_params.get("entity_type")
        actor = request.query_params.get("actor")
        q = (request.query_params.get("q") or "").strip()
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        if action:
            qs = qs.filter(action__icontains=action)
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        if actor:
            qs = qs.filter(actor_id=actor)
        if q:
            qs = qs.filter(Q(message__icontains=q) | Q(action__icontains=q) | Q(actor__username__icontains=q))
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        qs = qs[:200]
        return Response(AuditLogSerializer(qs, many=True).data)


class HealthView(APIView):
    """Liveness/readiness for Docker and load balancers (no auth)."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        from django.db import connection

        checks = {"database": "ok", "redis": "skipped"}
        try:
            connection.ensure_connection()
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except Exception as exc:
            checks["database"] = str(exc)

        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                import redis

                redis.from_url(redis_url).ping()
                checks["redis"] = "ok"
            except Exception as exc:
                checks["redis"] = str(exc)

        healthy = checks["database"] == "ok" and checks["redis"] in ("ok", "skipped")
        return Response(
            {
                "status": "ok" if healthy else "degraded",
                "checks": checks,
                "database": "postgresql" if os.getenv("USE_POSTGRES") == "1" else "sqlite",
            },
            status=status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by("-created_at")

    @action(detail=True, methods=["patch"])
    def read(self, request, pk=None):
        note = self.get_object()
        note.is_read = True
        note.save(update_fields=["is_read"])
        return Response(NotificationSerializer(note).data)

    @action(detail=False, methods=["post"])
    def read_all(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"detail": "ok"})
