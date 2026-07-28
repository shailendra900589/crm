from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    AuditLog,
    BulkUploadJob,
    CustomForm,
    FormSubmission,
    Lead,
    LeadDocument,
    LeadVisit,
    Merchant,
    Notification,
    Organization,
    Project,
    Team,
    User,
    VerificationWork,
)

admin.site.register(User, UserAdmin)
admin.site.register(Organization)
admin.site.register(Project)
admin.site.register(Team)
admin.site.register(CustomForm)
admin.site.register(FormSubmission)
admin.site.register(BulkUploadJob)
admin.site.register(Merchant)
admin.site.register(Lead)
admin.site.register(LeadDocument)
admin.site.register(VerificationWork)
admin.site.register(Notification)
admin.site.register(LeadVisit)
admin.site.register(AuditLog)
