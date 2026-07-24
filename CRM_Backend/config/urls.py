from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

admin.site.site_header = "CRM Django Admin"
admin.site.site_title = "CRM Django Admin"
admin.site.index_title = "Internal database admin (use Sales CRM UI for day-to-day)"

urlpatterns = [
    # Built-in Django admin — NOT at /admin (Next.js CRM Admin UI owns /admin)
    path("django-admin/", admin.site.urls),
    path("api/auth/login/", TokenObtainPairView.as_view()),
    path("api/auth/refresh/", TokenRefreshView.as_view()),
    path("api/", include("api.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
