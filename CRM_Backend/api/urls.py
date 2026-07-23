from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminDashboardView,
    AdminDigestView,
    AdminExportView,
    AdminManagersView,
    AuditLogListView,
    BulkJobView,
    ChangePasswordView,
    DashboardView,
    AlertsHubView,
    FollowUpsHubView,
    GlobalSearchView,
    HealthView,
    LeadViewSet,
    ManagerDashboardView,
    ManagerDrilldownView,
    MeView,
    MerchantViewSet,
    NotificationViewSet,
    PerformanceReportView,
    ProductViewSet,
    ProjectViewSet,
    SalesTargetViewSet,
    TeamViewSet,
    UserViewSet,
    VisitViewSet,
)

router = DefaultRouter()
router.register("projects", ProjectViewSet)
router.register("products", ProductViewSet)
router.register("merchants", MerchantViewSet)
router.register("leads", LeadViewSet)
router.register("teams", TeamViewSet)
router.register("users", UserViewSet)
router.register("visits", VisitViewSet)
router.register("notifications", NotificationViewSet)
router.register("sales-targets", SalesTargetViewSet)

urlpatterns = [
    path("health/", HealthView.as_view()),
    path("me/", MeView.as_view()),
    path("me/password/", ChangePasswordView.as_view()),
    path("search/", GlobalSearchView.as_view()),
    path("dashboard/", DashboardView.as_view()),
    path("follow-ups/", FollowUpsHubView.as_view()),
    path("alerts/", AlertsHubView.as_view()),
    path("reports/performance/", PerformanceReportView.as_view()),
    path("manager/dashboard/", ManagerDashboardView.as_view()),
    path("admin/dashboard/", AdminDashboardView.as_view()),
    path("admin/export/", AdminExportView.as_view()),
    path("admin/digest/", AdminDigestView.as_view()),
    path("admin/audit-logs/", AuditLogListView.as_view()),
    path("admin/managers/", AdminManagersView.as_view()),
    path("admin/managers/<int:manager_id>/dashboard/", ManagerDrilldownView.as_view()),
    path("bulk-jobs/<int:job_id>/", BulkJobView.as_view()),
    path("", include(router.urls)),
]
