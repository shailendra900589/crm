from django.contrib.auth.models import AbstractUser
from django.db import models


class Project(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=7, default="#2563eb")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        "User", null=True, blank=True, on_delete=models.SET_NULL, related_name="created_projects"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Product(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=120)
    slug = models.SlugField()
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("project", "slug")]

    def __str__(self):
        return f"{self.name} ({self.project.name})"


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "Admin", "Admin"
        MANAGER = "Manager", "Manager"
        TL = "TL", "Team Lead"
        BDM = "BDM", "BDM"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.BDM)
    reports_to = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="team"
    )
    mobile_number = models.CharField(max_length=15, blank=True)
    is_active_user = models.BooleanField(default=True)
    assigned_projects = models.ManyToManyField(Project, related_name="assigned_users", blank=True)


class Team(models.Model):
    name = models.CharField(max_length=100)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="teams")
    manager = models.ForeignKey(User, on_delete=models.CASCADE, related_name="managed_teams")
    members = models.ManyToManyField(User, related_name="teams", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.project.name})"


class CustomForm(models.Model):
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name="custom_form")
    title = models.CharField(max_length=200, default="Lead Form")
    schema = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Form: {self.project.name}"


class FormSubmission(models.Model):
    custom_form = models.ForeignKey(CustomForm, on_delete=models.CASCADE, related_name="submissions")
    lead = models.ForeignKey("Lead", on_delete=models.CASCADE, related_name="form_submissions")
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE)
    answers = models.JSONField(default=dict)
    submitted_at = models.DateTimeField(auto_now_add=True)


class BulkUploadJob(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="bulk_jobs")
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE)
    file = models.FileField(upload_to="bulk_uploads/")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    total_rows = models.IntegerField(default=0)
    success_rows = models.IntegerField(default=0)
    error_log = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)


class Merchant(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="merchants")
    name = models.CharField(max_length=200)
    mobile = models.CharField(max_length=15)
    email = models.EmailField(blank=True)
    brand_name = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("project", "mobile")]

    def __str__(self):
        return self.name


class Lead(models.Model):
    class Status(models.TextChoices):
        ORDER_CONFIRMED = "order_confirmed", "Order Confirmed"
        INTERESTED = "interested", "Interested"
        FOLLOW_UP = "follow_up", "Follow Up"
        NOT_INTERESTED = "not_interested", "Not Interested"
        CALLBACK = "callback", "Callback"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="leads")
    product = models.ForeignKey(
        Product, null=True, blank=True, on_delete=models.SET_NULL, related_name="leads"
    )
    merchant = models.ForeignKey(Merchant, on_delete=models.CASCADE, related_name="leads")
    bdm = models.ForeignKey(User, on_delete=models.CASCADE, related_name="leads")
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.INTERESTED)
    follow_up_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    custom_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.merchant.name} ({self.get_status_display()})"


class LeadDocument(models.Model):
    class VerificationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="documents")
    gst_file = models.FileField(upload_to="documents/gst/", blank=True, null=True)
    pan_file = models.FileField(upload_to="documents/pan/", blank=True, null=True)
    cheque_file = models.FileField(upload_to="documents/cheque/", blank=True, null=True)
    verification_status = models.CharField(
        max_length=20, choices=VerificationStatus.choices, default=VerificationStatus.PENDING
    )
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    message = models.CharField(max_length=500)
    is_read = models.BooleanField(default=False)
    link = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class LeadVisit(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        MISSED = "missed", "Missed"

    class VisitType(models.TextChoices):
        FIRST = "first", "First Visit"
        FOLLOW_UP = "follow_up", "Follow Up"
        REVISIT = "revisit", "Re-visit"

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="visits")
    assigned_to = models.ForeignKey(User, on_delete=models.CASCADE, related_name="assigned_visits")
    assigned_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="visits_created"
    )
    scheduled_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    visit_type = models.CharField(max_length=20, choices=VisitType.choices, default=VisitType.FOLLOW_UP)
    remarks = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    form_submission = models.ForeignKey(
        FormSubmission, null=True, blank=True, on_delete=models.SET_NULL, related_name="visits"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["scheduled_date", "-created_at"]

    def __str__(self):
        return f"{self.lead.merchant.name} — {self.scheduled_date}"


class AuditLog(models.Model):
    actor = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_logs"
    )
    action = models.CharField(max_length=64, db_index=True)
    entity_type = models.CharField(max_length=64, db_index=True)
    entity_id = models.PositiveIntegerField(null=True, blank=True)
    message = models.CharField(max_length=500)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} · {self.message[:60]}"


class SalesTarget(models.Model):
    """Monthly confirmed-order (and optional lead) targets per BDM."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sales_targets")
    project = models.ForeignKey(
        Project, null=True, blank=True, on_delete=models.CASCADE, related_name="sales_targets"
    )
    year = models.PositiveIntegerField()
    month = models.PositiveIntegerField()  # 1-12
    target_confirmed = models.PositiveIntegerField(default=0)
    target_leads = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="targets_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-year", "-month", "user__first_name"]
        unique_together = [("user", "project", "year", "month")]

    def __str__(self):
        return f"{self.user} {self.year}-{self.month:02d}"
