from django.contrib.auth import get_user_model
from rest_framework import serializers

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
    OrganizationDocument,
    Product,
    Project,
    SalesTarget,
    SubscriptionPackage,
    Team,
    VerificationWork,
)
from .permissions import get_descendant_ids

User = get_user_model()


class ProjectSerializer(serializers.ModelSerializer):
    lead_count = serializers.IntegerField(read_only=True, required=False)
    product_count = serializers.SerializerMethodField()
    organization_name = serializers.CharField(source="organization.name", read_only=True, allow_null=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "organization",
            "organization_name",
            "name",
            "slug",
            "description",
            "color",
            "is_active",
            "crm_pro_mobile_enabled",
            "lead_count",
            "product_count",
            "created_at",
        ]
        read_only_fields = ["slug", "created_at"]

    def get_product_count(self, obj):
        return getattr(obj, "product_count", None) or obj.products.filter(is_active=True).count()


class ProductSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    lead_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Product
        fields = ["id", "project", "project_name", "name", "slug", "description", "is_active", "lead_count", "created_at"]
        read_only_fields = ["slug", "created_at"]


class UserSerializer(serializers.ModelSerializer):
    reports_to_name = serializers.SerializerMethodField()
    assigned_project_ids = serializers.PrimaryKeyRelatedField(
        source="assigned_projects", many=True, read_only=True
    )
    organization_name = serializers.CharField(source="organization.name", read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email", "role",
            "mobile_number", "reports_to", "reports_to_name", "is_active_user",
            "assigned_project_ids", "crm_pro_mobile_enabled",
            "organization", "organization_name", "hrms_user_id", "can_edit_leads",
        ]

    def get_reports_to_name(self, obj):
        if not obj.reports_to_id:
            return None
        return obj.reports_to.get_full_name() or obj.reports_to.username


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    assigned_projects = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), many=True, required=False
    )

    class Meta:
        model = User
        fields = [
            "username", "password", "first_name", "last_name", "email", "role",
            "mobile_number", "reports_to", "assigned_projects", "organization",
            "can_edit_leads", "hrms_user_id",
        ]

    def validate_role(self, value):
        actor = self.context["request"].user
        if value == User.Role.SUPERADMIN:
            raise serializers.ValidationError("Super Admin cannot be created from Users.")
        if actor.role != User.Role.ADMIN and value == User.Role.ADMIN:
            raise serializers.ValidationError("Cannot create Admin users.")
        return value

    def create(self, validated_data):
        projects = validated_data.pop("assigned_projects", [])
        password = validated_data.pop("password")
        actor = self.context["request"].user
        validated_data.pop("organization", None)  # force org from actor
        if getattr(actor, "organization_id", None):
            validated_data["organization"] = actor.organization
        # Only allow assigning projects inside the actor's organization
        from .permissions import user_can_access_project

        safe_projects = [p for p in projects if user_can_access_project(actor, p.id)]
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if safe_projects:
            user.assigned_projects.set(safe_projects)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=6)
    assigned_projects = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), many=True, required=False
    )

    class Meta:
        model = User
        fields = [
            "first_name", "last_name", "email", "role", "mobile_number",
            "reports_to", "is_active_user", "password", "assigned_projects",
            "crm_pro_mobile_enabled", "organization", "can_edit_leads", "hrms_user_id",
        ]

    def validate_role(self, value):
        if value == User.Role.SUPERADMIN:
            raise serializers.ValidationError("Cannot assign Super Admin role.")
        actor = self.context["request"].user
        if actor.role != User.Role.ADMIN and value == User.Role.ADMIN:
            raise serializers.ValidationError("Cannot assign Admin role.")
        instance = getattr(self, "instance", None)
        if (
            instance
            and instance.role == User.Role.ADMIN
            and value != User.Role.ADMIN
            and getattr(actor, "role", None) != User.Role.SUPERADMIN
        ):
            raise serializers.ValidationError("Only Super Admin can demote an Admin.")
        return value

    def validate_is_active_user(self, value):
        actor = self.context["request"].user
        instance = getattr(self, "instance", None)
        if (
            instance
            and instance.role == User.Role.ADMIN
            and value is False
            and getattr(actor, "role", None) != User.Role.SUPERADMIN
        ):
            raise serializers.ValidationError(
                "Only Super Admin can deactivate a company Admin account."
            )
        return value

    def update(self, instance, validated_data):
        if instance.role == User.Role.SUPERADMIN:
            raise serializers.ValidationError("Super Admin accounts cannot be edited here.")
        password = validated_data.pop("password", None)
        projects = validated_data.pop("assigned_projects", None)
        validated_data.pop("organization", None)  # keep org locked to company
        actor = self.context["request"].user
        # Hard lock: non–Super Admin cannot deactivate / demote Admin
        if instance.role == User.Role.ADMIN and getattr(actor, "role", None) != User.Role.SUPERADMIN:
            validated_data.pop("is_active_user", None)
            validated_data["role"] = User.Role.ADMIN
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        if "is_active_user" in validated_data:
            instance.is_active = bool(instance.is_active_user)
        instance.save()
        if projects is not None:
            from .permissions import user_can_access_project

            actor = self.context["request"].user
            safe_projects = [p for p in projects if user_can_access_project(actor, p.id)]
            instance.assigned_projects.set(safe_projects)
        return instance


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "message", "is_read", "link", "created_at"]


class MerchantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Merchant
        fields = "__all__"


class LeadDocumentSerializer(serializers.ModelSerializer):
    gst_file_url = serializers.SerializerMethodField()
    pan_file_url = serializers.SerializerMethodField()
    cheque_file_url = serializers.SerializerMethodField()
    verified_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LeadDocument
        fields = [
            "id", "gst_file", "pan_file", "cheque_file",
            "gst_file_url", "pan_file_url", "cheque_file_url",
            "verification_status", "verified_by", "verified_by_name", "uploaded_at",
        ]
        read_only_fields = ["verified_by", "uploaded_at"]

    def _file_url(self, obj, field):
        f = getattr(obj, field, None)
        if not f:
            return None
        try:
            url = f.url
        except Exception:
            return None
        if url.startswith("http"):
            return url
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_gst_file_url(self, obj):
        return self._file_url(obj, "gst_file")

    def get_pan_file_url(self, obj):
        return self._file_url(obj, "pan_file")

    def get_cheque_file_url(self, obj):
        return self._file_url(obj, "cheque_file")

    def get_verified_by_name(self, obj):
        if not obj.verified_by_id:
            return None
        return obj.verified_by.get_full_name() or obj.verified_by.username


class LeadSerializer(serializers.ModelSerializer):
    merchant_name = serializers.CharField(source="merchant.name", read_only=True)
    merchant_mobile = serializers.CharField(source="merchant.mobile", read_only=True)
    merchant_email = serializers.EmailField(source="merchant.email", read_only=True)
    brand_name = serializers.CharField(source="merchant.brand_name", read_only=True)
    merchant_city = serializers.CharField(source="merchant.city", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    product_name = serializers.SerializerMethodField()
    bdm_name = serializers.SerializerMethodField()
    documents = LeadDocumentSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Lead
        fields = [
            "id", "project", "project_name", "product", "product_name", "merchant", "merchant_name", "merchant_mobile",
            "merchant_email", "brand_name", "merchant_city", "bdm", "bdm_name",
            "status", "status_display", "follow_up_date", "notes", "custom_data",
            "documents", "created_at", "updated_at",
        ]

    def get_bdm_name(self, obj):
        return obj.bdm.get_full_name() or obj.bdm.username

    def get_product_name(self, obj):
        return obj.product.name if obj.product_id else None


class LeadWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = ["id", "project", "merchant", "bdm", "status", "follow_up_date", "notes"]


class LeadCreateSerializer(serializers.Serializer):
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all())
    merchant_name = serializers.CharField(max_length=200)
    merchant_mobile = serializers.CharField(max_length=15)
    merchant_email = serializers.EmailField(required=False, allow_blank=True, default="")
    brand_name = serializers.CharField(required=False, allow_blank=True, default="")
    city = serializers.CharField(required=False, allow_blank=True, default="")
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), required=False, allow_null=True)
    status = serializers.ChoiceField(choices=Lead.Status.choices, default=Lead.Status.INTERESTED)
    follow_up_date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    bdm = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role__in=[User.Role.BDM, User.Role.TL]),
        required=False,
        allow_null=True,
    )
    force = serializers.BooleanField(required=False, default=False, write_only=True)

    def validate_project(self, project):
        from .permissions import user_can_access_project

        user = self.context["request"].user
        if not user_can_access_project(user, project.id):
            raise serializers.ValidationError("You do not have access to this project.")
        return project

    def validate(self, attrs):
        product = attrs.get("product")
        project = attrs.get("project")
        if product and project and product.project_id != project.id:
            raise serializers.ValidationError({"product": "Product must belong to the selected project."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("force", None)
        user = self.context["request"].user
        project = validated_data["project"]
        bdm = validated_data.pop("bdm", None) or user
        if user.role == User.Role.BDM:
            bdm = user
        merchant, _ = Merchant.objects.update_or_create(
            project=project,
            mobile=validated_data["merchant_mobile"],
            defaults={
                "name": validated_data["merchant_name"],
                "email": validated_data.get("merchant_email", ""),
                "brand_name": validated_data.get("brand_name", ""),
                "city": validated_data.get("city", ""),
            },
        )
        return Lead.objects.create(
            project=project,
            product=validated_data.get("product"),
            merchant=merchant,
            bdm=bdm,
            status=validated_data.get("status", Lead.Status.INTERESTED),
            follow_up_date=validated_data.get("follow_up_date"),
            notes=validated_data.get("notes", ""),
        )


class LeadUpdateSerializer(serializers.ModelSerializer):
    merchant_name = serializers.CharField(required=False)
    merchant_mobile = serializers.CharField(required=False)
    merchant_email = serializers.EmailField(required=False, allow_blank=True)
    brand_name = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Lead
        fields = [
            "status", "follow_up_date", "notes", "custom_data", "product",
            "merchant_name", "merchant_mobile", "merchant_email", "brand_name", "city",
        ]

    def update(self, instance, validated_data):
        merchant_map = {
            "merchant_name": "name",
            "merchant_mobile": "mobile",
            "merchant_email": "email",
            "brand_name": "brand_name",
            "city": "city",
        }
        for key, field in merchant_map.items():
            if key in validated_data:
                setattr(instance.merchant, field, validated_data.pop(key))
        instance.merchant.save()
        custom_changed = "custom_data" in validated_data
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if custom_changed:
            from .form_sync import sync_lead_form_data

            actor = self.context.get("request").user if self.context.get("request") else None
            sync_lead_form_data(instance, instance.custom_data or {}, actor=actor, bump_submitted_at=True)
        return instance


class TeamSerializer(serializers.ModelSerializer):
    member_names = serializers.SerializerMethodField()
    member_details = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="project.name", read_only=True)
    manager_name = serializers.SerializerMethodField()
    members = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active_user=True),
        many=True,
        required=False,
    )

    class Meta:
        model = Team
        fields = [
            "id", "name", "project", "project_name", "manager", "manager_name",
            "members", "member_names", "member_details", "created_at",
        ]

    def get_member_names(self, obj):
        return [u.get_full_name() or u.username for u in obj.members.all()]

    def get_member_details(self, obj):
        return [
            {
                "id": u.id,
                "name": u.get_full_name() or u.username,
                "role": u.role,
                "username": u.username,
            }
            for u in obj.members.all()
        ]

    def get_manager_name(self, obj):
        return obj.manager.get_full_name() or obj.manager.username

    def validate_manager(self, manager):
        if manager.role not in (User.Role.MANAGER, User.Role.TL, User.Role.ADMIN):
            raise serializers.ValidationError("Team manager must be a Manager, TL, or Admin.")
        return manager

    def validate(self, data):
        request = self.context.get("request")
        if not request:
            return data
        actor = request.user
        manager = data.get("manager") or (self.instance.manager if self.instance else None)
        members = data.get("members")
        if members is None and self.instance:
            return data

        member_list = list(members or [])
        if actor.role == User.Role.ADMIN:
            return data

        if actor.role in (User.Role.MANAGER, User.Role.TL):
            if self.instance and self.instance.manager_id != actor.id:
                raise serializers.ValidationError("You can only edit teams you manage.")
            if manager and manager.id != actor.id:
                raise serializers.ValidationError("You cannot assign teams to another manager.")
            allowed = get_descendant_ids(actor) | {actor.id}
            for member in member_list:
                if member.id not in allowed:
                    raise serializers.ValidationError(
                        f"{member.get_full_name() or member.username} is not in your reporting hierarchy."
                    )
        return data


class CustomFormSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = CustomForm
        fields = [
            "id",
            "project",
            "project_name",
            "title",
            "schema",
            "is_active",
            "enable_collection",
            "updated_at",
        ]


class FormSubmissionSerializer(serializers.ModelSerializer):
    lead_name = serializers.CharField(source="lead.merchant.name", read_only=True)
    submitted_by_name = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="custom_form.project.name", read_only=True)
    answer_preview = serializers.SerializerMethodField()
    answer_count = serializers.SerializerMethodField()

    class Meta:
        model = FormSubmission
        fields = [
            "id", "custom_form", "lead", "lead_name", "project_name",
            "submitted_by", "submitted_by_name", "answers", "answer_preview", "answer_count", "submitted_at",
        ]
        read_only_fields = ["submitted_by", "submitted_at"]

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.get_full_name() or obj.submitted_by.username

    def get_answer_preview(self, obj):
        from .form_sync import answer_preview

        schema = []
        try:
            schema = obj.custom_form.schema or []
        except Exception:
            schema = []
        return answer_preview(obj.answers or {}, schema)

    def get_answer_count(self, obj):
        answers = obj.answers or {}
        return sum(1 for v in answers.values() if v not in (None, "", [], {}))


class LeadVisitSerializer(serializers.ModelSerializer):
    lead_name = serializers.CharField(source="lead.merchant.name", read_only=True)
    merchant_city = serializers.CharField(source="lead.merchant.city", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    assigned_by_name = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="lead.project.name", read_only=True)
    bdm_name = serializers.SerializerMethodField()

    class Meta:
        model = LeadVisit
        fields = [
            "id", "lead", "lead_name", "merchant_city", "project_name", "bdm_name",
            "assigned_to", "assigned_to_name", "assigned_by", "assigned_by_name",
            "scheduled_date", "status", "visit_type", "remarks", "completed_at", "created_at",
        ]
        read_only_fields = ["assigned_by", "completed_at", "created_at"]

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.get_full_name() or obj.assigned_to.username

    def get_assigned_by_name(self, obj):
        if not obj.assigned_by_id:
            return None
        return obj.assigned_by.get_full_name() or obj.assigned_by.username

    def get_bdm_name(self, obj):
        return obj.lead.bdm.get_full_name() or obj.lead.bdm.username


class BulkUploadJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = BulkUploadJob
        fields = ["id", "project", "status", "total_rows", "success_rows", "error_log", "created_at"]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id", "actor", "actor_name", "action", "entity_type", "entity_id",
            "message", "meta", "created_at",
        ]

    def get_actor_name(self, obj):
        if not obj.actor_id:
            return "System"
        return obj.actor.get_full_name() or obj.actor.username


class SalesTargetSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="project.name", read_only=True, allow_null=True)
    created_by_name = serializers.SerializerMethodField()
    actual_confirmed = serializers.IntegerField(read_only=True, required=False)
    actual_leads = serializers.IntegerField(read_only=True, required=False)
    confirmed_pct = serializers.FloatField(read_only=True, required=False)
    leads_pct = serializers.FloatField(read_only=True, required=False)

    class Meta:
        model = SalesTarget
        fields = [
            "id", "user", "user_name", "project", "project_name",
            "year", "month", "target_confirmed", "target_leads",
            "created_by", "created_by_name", "created_at", "updated_at",
            "actual_confirmed", "actual_leads", "confirmed_pct", "leads_pct",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at"]

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_created_by_name(self, obj):
        if not obj.created_by_id:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username

    def validate_month(self, value):
        if value < 1 or value > 12:
            raise serializers.ValidationError("Month must be 1–12.")
        return value


class SubscriptionPackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPackage
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "price",
            "currency",
            "trial_days",
            "module_keys",
            "is_active",
            "is_default",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_module_keys(self, value):
        from .entitlements import sanitize_modules

        return sanitize_modules(value or [])

    def create(self, validated_data):
        from django.utils.text import slugify

        from .entitlements import sanitize_modules

        if not validated_data.get("slug"):
            base = slugify(validated_data.get("name") or "package")[:40] or "package"
            slug = base
            n = 1
            while SubscriptionPackage.objects.filter(slug=slug).exists():
                n += 1
                slug = f"{base}-{n}"
            validated_data["slug"] = slug
        validated_data["module_keys"] = sanitize_modules(validated_data.get("module_keys"))
        if validated_data.get("is_default"):
            SubscriptionPackage.objects.filter(is_default=True).update(is_default=False)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        from .entitlements import sanitize_modules

        if "module_keys" in validated_data:
            validated_data["module_keys"] = sanitize_modules(validated_data.get("module_keys"))
        if validated_data.get("is_default"):
            SubscriptionPackage.objects.filter(is_default=True).exclude(pk=instance.pk).update(is_default=False)
        return super().update(instance, validated_data)


class OrganizationDocumentSerializer(serializers.ModelSerializer):
    doc_type_display = serializers.CharField(source="get_doc_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    file_url = serializers.SerializerMethodField()
    verified_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationDocument
        fields = [
            "id",
            "organization",
            "doc_type",
            "doc_type_display",
            "label",
            "file",
            "file_url",
            "status",
            "status_display",
            "notes",
            "uploaded_by",
            "verified_by",
            "verified_by_name",
            "verified_at",
            "created_at",
        ]
        read_only_fields = ["organization", "uploaded_by", "verified_by", "verified_at", "created_at"]

    def get_file_url(self, obj):
        try:
            return obj.file.url if obj.file else None
        except Exception:
            return None

    def get_verified_by_name(self, obj):
        if not obj.verified_by_id:
            return None
        u = obj.verified_by
        return u.get_full_name() or u.username


class OrganizationSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    user_count = serializers.SerializerMethodField()
    project_count = serializers.SerializerMethodField()
    document_count = serializers.SerializerMethodField()
    access_allowed = serializers.BooleanField(source="is_access_allowed", read_only=True)
    package_name = serializers.CharField(source="package.name", read_only=True, allow_null=True)
    package_price = serializers.DecimalField(
        source="package.price", max_digits=12, decimal_places=2, read_only=True, allow_null=True
    )
    payment_status_display = serializers.CharField(source="get_payment_status_display", read_only=True)
    docs_verification_status_display = serializers.CharField(
        source="get_docs_verification_status_display", read_only=True
    )
    docs_verified_by_name = serializers.SerializerMethodField()
    documents = OrganizationDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "email",
            "phone",
            "city",
            "status",
            "status_display",
            "plan_label",
            "trial_ends_at",
            "payment_notes",
            "package",
            "package_name",
            "package_price",
            "enabled_modules",
            "payment_status",
            "payment_status_display",
            "amount_paid",
            "paid_at",
            "package_assigned_at",
            "docs_verification_status",
            "docs_verification_status_display",
            "docs_verified_at",
            "docs_verified_by_name",
            "docs_rejection_reason",
            "documents",
            "document_count",
            "hrms_connected",
            "hrms_company_id",
            "hrms_api_base_url",
            "admin_name",
            "is_public",
            "created_at",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "user_count",
            "project_count",
            "access_allowed",
        ]
        read_only_fields = [
            "slug",
            "created_at",
            "approved_by",
            "approved_at",
            "paid_at",
            "package_assigned_at",
            "docs_verified_at",
        ]

    def get_approved_by_name(self, obj):
        if not obj.approved_by_id:
            return None
        return obj.approved_by.get_full_name() or obj.approved_by.username

    def get_docs_verified_by_name(self, obj):
        if not obj.docs_verified_by_id:
            return None
        return obj.docs_verified_by.get_full_name() or obj.docs_verified_by.username

    def get_user_count(self, obj):
        return obj.users.filter(is_active_user=True).count()

    def get_project_count(self, obj):
        return obj.projects.filter(is_active=True).count()

    def get_document_count(self, obj):
        return obj.documents.count()


class OrganizationWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            "name",
            "email",
            "phone",
            "city",
            "status",
            "plan_label",
            "trial_ends_at",
            "payment_notes",
            "hrms_connected",
            "hrms_company_id",
            "hrms_api_base_url",
            "admin_name",
            "is_public",
        ]

    def create(self, validated_data):
        from django.utils.text import slugify

        from .entitlements import apply_package_to_org, get_default_package, sanitize_modules

        name = validated_data.get("name") or "Company"
        base = slugify(name)[:40] or "company"
        slug = base
        n = 1
        while Organization.objects.filter(slug=slug).exists():
            n += 1
            slug = f"{base}-{n}"
        validated_data["slug"] = slug
        org = super().create(validated_data)
        pkg = get_default_package()
        if pkg:
            apply_package_to_org(org, pkg)
            if org.status == Organization.Status.TRIAL and not org.trial_ends_at:
                from datetime import timedelta

                from django.utils import timezone

                org.trial_ends_at = timezone.now() + timedelta(days=max(1, pkg.trial_days or 15))
            org.save()
        elif not org.enabled_modules:
            org.enabled_modules = sanitize_modules([])
            org.save(update_fields=["enabled_modules"])
        return org


class VerificationWorkSerializer(serializers.ModelSerializer):
    lead_name = serializers.CharField(source="lead.merchant.name", read_only=True)
    project_name = serializers.CharField(source="lead.project.name", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    assigned_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    document_status = serializers.CharField(source="document.verification_status", read_only=True, allow_null=True)
    merchant_city = serializers.CharField(source="lead.merchant.city", read_only=True)
    answers = serializers.SerializerMethodField()
    answer_preview = serializers.SerializerMethodField()
    form_schema = serializers.SerializerMethodField()

    class Meta:
        model = VerificationWork
        fields = [
            "id",
            "organization",
            "lead",
            "lead_name",
            "project_name",
            "merchant_city",
            "form_submission",
            "document",
            "document_status",
            "title",
            "status",
            "status_display",
            "priority",
            "assigned_to",
            "assigned_to_name",
            "assigned_by",
            "assigned_by_name",
            "due_date",
            "assign_notes",
            "completion_notes",
            "allow_edit",
            "answers",
            "answer_preview",
            "form_schema",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["organization", "assigned_by", "completed_at", "created_at", "updated_at"]

    def _resolved_answers(self, obj):
        if obj.form_submission_id and getattr(obj.form_submission, "answers", None):
            return obj.form_submission.answers or {}
        return (obj.lead.custom_data or {}) if obj.lead_id else {}

    def _schema(self, obj):
        form = getattr(getattr(obj.lead, "project", None), "custom_form", None)
        return (form.schema if form else None) or []

    def get_answers(self, obj):
        return self._resolved_answers(obj)

    def get_answer_preview(self, obj):
        from .form_sync import answer_preview

        return answer_preview(self._resolved_answers(obj), self._schema(obj))

    def get_form_schema(self, obj):
        """Compact schema for verification desk display/edit."""
        out = []
        for f in self._schema(obj):
            if not f.get("field_id"):
                continue
            out.append(
                {
                    "field_id": f.get("field_id"),
                    "label": f.get("label") or f.get("field_id"),
                    "type": f.get("type") or "text",
                    "required": bool(f.get("required")),
                }
            )
        return out

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to_id:
            return None
        return obj.assigned_to.get_full_name() or obj.assigned_to.username

    def get_assigned_by_name(self, obj):
        if not obj.assigned_by_id:
            return None
        return obj.assigned_by.get_full_name() or obj.assigned_by.username
