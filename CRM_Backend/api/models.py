from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class SubscriptionPackage(models.Model):
    """Super Admin–defined SaaS package with budget and module entitlements."""

    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default="INR")
    trial_days = models.PositiveIntegerField(default=15)
    module_keys = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False, help_text="Assigned to new trial companies")
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "price", "name"]

    def __str__(self):
        return f"{self.name} ({self.price} {self.currency})"


class Organization(models.Model):
    """Tenant / company that owns CRM projects and employees."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending approval"
        TRIAL = "trial", "Trial"
        ACTIVE = "active", "Active (paid)"
        SUSPENDED = "suspended", "Suspended"
        REJECTED = "rejected", "Rejected"

    class PaymentStatus(models.TextChoices):
        NONE = "none", "No payment"
        PENDING = "pending", "Payment pending"
        PAID = "paid", "Paid"

    class DocsVerificationStatus(models.TextChoices):
        PENDING = "pending", "Awaiting documents"
        IN_REVIEW = "in_review", "Under Super Admin review"
        VERIFIED = "verified", "Corporate docs verified"
        REJECTED = "rejected", "Documents rejected"

    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    city = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    plan_label = models.CharField(max_length=120, blank=True, default="Trial")
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    payment_notes = models.TextField(blank=True, help_text="Super Admin payment / commercial notes")
    package = models.ForeignKey(
        SubscriptionPackage,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="organizations",
    )
    enabled_modules = models.JSONField(
        default=list,
        blank=True,
        help_text="Module keys this company may use (Super Admin / package controlled)",
    )
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.NONE, db_index=True
    )
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    package_assigned_at = models.DateTimeField(null=True, blank=True)
    docs_verification_status = models.CharField(
        max_length=20,
        choices=DocsVerificationStatus.choices,
        default=DocsVerificationStatus.PENDING,
        db_index=True,
    )
    docs_verified_at = models.DateTimeField(null=True, blank=True)
    docs_verified_by = models.ForeignKey(
        "User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="orgs_docs_verified",
    )
    docs_rejection_reason = models.TextField(blank=True)
    hrms_connected = models.BooleanField(default=False)
    hrms_company_id = models.CharField(max_length=64, blank=True)
    hrms_api_base_url = models.URLField(blank=True, default="https://hrms.trackbook.co")
    admin_name = models.CharField(max_length=120, blank=True)
    is_public = models.BooleanField(default=False, help_text="Published by Super Admin for signup visibility")
    created_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(
        "User", null=True, blank=True, on_delete=models.SET_NULL, related_name="orgs_approved"
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def is_access_allowed(self) -> bool:
        if self.status == self.Status.REJECTED:
            return False
        if self.status == self.Status.SUSPENDED:
            return False
        if self.status == self.Status.PENDING:
            return False
        if self.docs_verification_status != self.DocsVerificationStatus.VERIFIED:
            return False
        if self.status == self.Status.TRIAL and self.trial_ends_at and self.trial_ends_at < timezone.now():
            return False
        return self.status in (self.Status.TRIAL, self.Status.ACTIVE)


class OrganizationDocument(models.Model):
    """Corporate KYC / registration documents reviewed by Super Admin."""

    class DocType(models.TextChoices):
        GST = "gst_certificate", "GST certificate"
        PAN = "pan_card", "Company PAN"
        INCORPORATION = "incorporation", "Certificate of incorporation"
        ADDRESS = "address_proof", "Address proof"
        CHEQUE = "cancelled_cheque", "Cancelled cheque"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="documents")
    doc_type = models.CharField(max_length=40, choices=DocType.choices, default=DocType.OTHER)
    label = models.CharField(max_length=160, blank=True)
    file = models.FileField(upload_to="org_docs/%Y/%m/")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    notes = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        "User", null=True, blank=True, on_delete=models.SET_NULL, related_name="org_docs_uploaded"
    )
    verified_by = models.ForeignKey(
        "User", null=True, blank=True, on_delete=models.SET_NULL, related_name="org_docs_reviewed"
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.organization_id} · {self.doc_type}"


class Project(models.Model):
    organization = models.ForeignKey(
        Organization, null=True, blank=True, on_delete=models.CASCADE, related_name="projects"
    )
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=7, default="#2563eb")
    is_active = models.BooleanField(default=True)
    crm_pro_mobile_enabled = models.BooleanField(
        default=False,
        help_text="When enabled, BDM/TL/Manager users on this project can open CRM Pro in Trackbook mobile.",
    )
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
        SUPERADMIN = "SuperAdmin", "Super Admin"
        ADMIN = "Admin", "Admin"
        MANAGER = "Manager", "Manager"
        TL = "TL", "Team Lead"
        BDM = "BDM", "BDM"
        OPS = "Ops", "Office Ops"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.BDM)
    organization = models.ForeignKey(
        Organization, null=True, blank=True, on_delete=models.SET_NULL, related_name="users"
    )
    reports_to = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="team"
    )
    mobile_number = models.CharField(max_length=15, blank=True)
    is_active_user = models.BooleanField(default=True)
    hrms_user_id = models.CharField(max_length=64, blank=True, db_index=True)
    can_edit_leads = models.BooleanField(
        default=True,
        help_text="When True, user may edit lead/form data (subject to hierarchy).",
    )
    crm_pro_mobile_enabled = models.BooleanField(
        null=True,
        blank=True,
        default=None,
        help_text="Override CRM Pro mobile access. Null = inherit from assigned projects.",
    )
    assigned_projects = models.ManyToManyField(Project, related_name="assigned_users", blank=True)
    organization_role = models.ForeignKey(
        "OrganizationRole",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="users",
        help_text="Custom / org role for page permissions. Hierarchy still uses User.role (base capability).",
    )


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
    enable_collection = models.BooleanField(
        default=False,
        help_text="Show Amount Collected / payment fields on this form for BDMs.",
    )
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Form: {self.project.name}"


class FormSubmission(models.Model):
    custom_form = models.ForeignKey(CustomForm, on_delete=models.CASCADE, related_name="submissions")
    lead = models.ForeignKey("Lead", on_delete=models.CASCADE, related_name="form_submissions")
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE)
    answers = models.JSONField(default=dict)
    submitted_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["lead", "custom_form"], name="uniq_formsubmission_lead_form"),
        ]


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


class VerificationWork(models.Model):
    """
    Office verification task:
    BDM submits form/docs → Manager/TL assigns Ops → Ops completes → supervisors see on dashboard.
    """

    class Status(models.TextChoices):
        OPEN = "open", "Open (unassigned)"
        ASSIGNED = "assigned", "Assigned"
        IN_PROGRESS = "in_progress", "In progress"
        DONE = "done", "Completed"
        REJECTED = "rejected", "Rejected"
        REOPENED = "reopened", "Reopened"

    class Priority(models.TextChoices):
        NORMAL = "normal", "Normal"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    organization = models.ForeignKey(
        Organization, null=True, blank=True, on_delete=models.CASCADE, related_name="verification_works"
    )
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="verification_works")
    form_submission = models.ForeignKey(
        FormSubmission, null=True, blank=True, on_delete=models.SET_NULL, related_name="verification_works"
    )
    document = models.ForeignKey(
        LeadDocument, null=True, blank=True, on_delete=models.SET_NULL, related_name="verification_works"
    )
    title = models.CharField(max_length=200, default="Verify documents")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.NORMAL)
    assigned_to = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="verification_assigned"
    )
    assigned_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="verification_created"
    )
    due_date = models.DateField(null=True, blank=True)
    assign_notes = models.TextField(blank=True)
    completion_notes = models.TextField(blank=True)
    allow_edit = models.BooleanField(
        default=True,
        help_text="Assignee may edit lead form answers while working this task.",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} · {self.lead_id} · {self.status}"


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


class RolePagePermission(models.Model):
    """Legacy global page access for Manager / TL / BDM / Ops (seed template)."""

    role = models.CharField(max_length=20, choices=User.Role.choices, db_index=True)
    page_key = models.CharField(max_length=64, db_index=True)
    enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["role", "page_key"]
        unique_together = [("role", "page_key")]

    def __str__(self):
        state = "on" if self.enabled else "off"
        return f"{self.role} · {self.page_key} · {state}"


class OrganizationRole(models.Model):
    """Per-company role (system Manager/TL/BDM/Ops + custom roles Admin can create)."""

    class BaseRole(models.TextChoices):
        MANAGER = "Manager", "Manager"
        TL = "TL", "Team Lead"
        BDM = "BDM", "BDM"
        OPS = "Ops", "Office Ops"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="roles")
    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=80)
    description = models.CharField(max_length=255, blank=True, default="")
    base_role = models.CharField(max_length=20, choices=BaseRole.choices, default=BaseRole.BDM)
    is_system = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_system", "name"]
        unique_together = [("organization", "slug")]

    def __str__(self):
        return f"{self.organization_id} · {self.name}"


class OrganizationRolePagePermission(models.Model):
    role = models.ForeignKey(OrganizationRole, on_delete=models.CASCADE, related_name="page_permissions")
    page_key = models.CharField(max_length=64, db_index=True)
    enabled = models.BooleanField(default=True)

    class Meta:
        ordering = ["page_key"]
        unique_together = [("role", "page_key")]

    def __str__(self):
        return f"{self.role_id} · {self.page_key} · {'on' if self.enabled else 'off'}"


class PasswordResetOTP(models.Model):
    """One-time codes for forgot-password flow (emailed via SMTP)."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_otps")
    otp_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"OTP for {self.user_id} @ {self.created_at}"
