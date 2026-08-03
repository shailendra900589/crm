from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminDashboardView,
    AdminDigestView,
    AdminExportView,
    AdminManagersView,
    AdminPagePermissionsView,
    AuditLogListView,
    BulkJobView,
    ChangePasswordView,
    DashboardView,
    AlertsHubView,
    FollowUpsHubView,
    FormSubmissionsRecentView,
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
from .workflow_views import (
    OrganizationViewSet,
    RegisterOrganizationView,
    SubscriptionPackageViewSet,
    VerificationWorkViewSet,
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
router.register("organizations", OrganizationViewSet)
router.register("packages", SubscriptionPackageViewSet, basename="packages")
router.register("verification-works", VerificationWorkViewSet, basename="verification-works")

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
    path("form-submissions/recent/", FormSubmissionsRecentView.as_view()),
    path("admin/audit-logs/", AuditLogListView.as_view()),
    path("admin/managers/", AdminManagersView.as_view()),
    path("admin/managers/<int:manager_id>/dashboard/", ManagerDrilldownView.as_view()),
    path("admin/page-permissions/", AdminPagePermissionsView.as_view()),
    path("public/register-organization/", RegisterOrganizationView.as_view()),
    path("bulk-jobs/<int:job_id>/", BulkJobView.as_view()),
    path("", include(router.urls)),
]
