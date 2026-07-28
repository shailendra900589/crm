from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from api.models import CustomForm, FormSubmission, Lead, LeadVisit, Merchant, Organization, Product, Project, Team

User = get_user_model()


DEFAULT_FORM = [
    {"field_id": "gst_number", "label": "GST Number", "type": "text", "required": True},
    {"field_id": "business_type", "label": "Business Type", "type": "dropdown", "required": True, "options": ["Retail", "Wholesale", "Manufacturer"]},
    {"field_id": "annual_revenue", "label": "Annual Revenue", "type": "number", "required": False},
    {
        "field_id": "pending_amount",
        "label": "Collection Pending Amount",
        "type": "currency",
        "required": False,
        "currency": "INR",
        "metric_role": "pending_amount",
        "min": 0,
    },
    {
        "field_id": "amount_collected",
        "label": "Amount Collected",
        "type": "currency",
        "required": False,
        "currency": "INR",
        "metric_role": "collection",
        "min": 0,
    },
    {
        "field_id": "gst_certificate",
        "label": "GST Certificate",
        "type": "file",
        "required": False,
        "file_accept": "pdf_image",
        "max_file_mb": 10,
    },
]


class Command(BaseCommand):
    help = "Seed demo users, projects, teams, forms, merchants, and leads"

    def handle(self, *args, **options):
        # Ensure default org exists before touching users (needs migration 0013+)
        default_org, _ = Organization.objects.get_or_create(
            slug="default",
            defaults={
                "name": "Default Company",
                "email": "admin@crm.local",
                "status": Organization.Status.ACTIVE,
                "plan_label": "Legacy",
                "is_public": True,
            },
        )

        admin, _ = User.objects.get_or_create(
            username="admin",
            defaults={
                "role": User.Role.ADMIN,
                "first_name": "Admin",
                "email": "admin@crm.local",
                "organization": default_org,
            },
        )
        admin.role = User.Role.ADMIN
        admin.organization = default_org
        admin.is_active = True
        admin.is_active_user = True
        admin.is_staff = True
        admin.is_superuser = True
        admin.set_password("password123")
        admin.save()

        superadmin, _ = User.objects.get_or_create(
            username="superadmin",
            defaults={
                "role": User.Role.SUPERADMIN,
                "first_name": "Super",
                "last_name": "Admin",
                "email": "superadmin@crm.local",
            },
        )
        superadmin.role = User.Role.SUPERADMIN
        superadmin.organization = None
        superadmin.is_active = True
        superadmin.is_active_user = True
        superadmin.is_staff = True
        superadmin.is_superuser = True
        superadmin.set_password("password123")
        superadmin.save()

        manager, _ = User.objects.get_or_create(
            username="manager",
            defaults={"role": User.Role.MANAGER, "first_name": "Raj", "reports_to": admin, "email": "manager@crm.local", "organization": default_org},
        )
        manager.role = User.Role.MANAGER
        manager.organization = default_org
        manager.is_active = True
        manager.is_active_user = True
        manager.set_password("password123")
        manager.save()

        tl, _ = User.objects.get_or_create(
            username="tl",
            defaults={"role": User.Role.TL, "first_name": "Priya", "reports_to": manager, "email": "tl@crm.local", "organization": default_org},
        )
        tl.role = User.Role.TL
        tl.organization = default_org
        tl.is_active = True
        tl.is_active_user = True
        tl.set_password("password123")
        tl.save()

        bdm, _ = User.objects.get_or_create(
            username="bdm",
            defaults={"role": User.Role.BDM, "first_name": "Amit", "reports_to": tl, "email": "bdm@crm.local", "organization": default_org},
        )
        bdm.role = User.Role.BDM
        bdm.organization = default_org
        bdm.is_active = True
        bdm.is_active_user = True
        bdm.set_password("password123")
        bdm.save()

        projects_data = [
            ("Amazon", "Amazon Merchant Onboarding", "#FF9900", ["Seller Central", "FBA", "Advertising"]),
            ("Flipkart", "Flipkart Seller Onboarding", "#2874F0", ["Seller Hub", "Flipkart Plus"]),
            ("Meesho", "Meesho Supplier Onboarding", "#F43397", ["Supplier Panel", "Meesho Mall"]),
        ]

        projects = []
        for name, desc, color, product_names in projects_data:
            project, _ = Project.objects.get_or_create(
                slug=slugify(name),
                defaults={
                    "name": name,
                    "description": desc,
                    "color": color,
                    "created_by": admin,
                    "organization": default_org,
                },
            )
            if not project.organization_id:
                project.organization = default_org
                project.save(update_fields=["organization"])
            projects.append(project)
            for pname in product_names:
                Product.objects.get_or_create(
                    project=project,
                    slug=slugify(pname),
                    defaults={"name": pname, "description": f"{pname} for {name}"},
                )
            form, created = CustomForm.objects.get_or_create(
                project=project,
                defaults={
                    "title": f"{name} Onboarding Form",
                    "schema": DEFAULT_FORM,
                    "created_by": admin,
                    "enable_collection": True,
                },
            )
            if not created:
                # Keep title; refresh schema so new money KPI fields are available
                existing_ids = {f.get("field_id") for f in (form.schema or [])}
                merged = list(form.schema or [])
                for field in DEFAULT_FORM:
                    if field["field_id"] not in existing_ids:
                        merged.append(field)
                form.schema = merged or DEFAULT_FORM
                form.enable_collection = True
                form.save(update_fields=["schema", "enable_collection"])
            team, _ = Team.objects.get_or_create(
                project=project, manager=manager,
                defaults={"name": f"{name} Sales Team"},
            )
            team.members.set([bdm, tl])

        # Project hierarchy: Manager owns Flipkart only; TL/BDM inherit via reports_to
        # (other projects remain Admin-only unless assigned)
        flipkart = next((p for p in projects if p.slug == "flipkart"), projects[0])
        manager.assigned_projects.set([flipkart])
        tl.assigned_projects.set([flipkart])
        bdm.assigned_projects.set([flipkart])

        merchants_data = [
            ("Sharma Electronics", "9876543210", "Mumbai", "Sharma Tech"),
            ("Patel Foods", "9876543211", "Ahmedabad", "Patel Fresh"),
            ("Kumar Fashion", "9876543212", "Delhi", "Kumar Style"),
            ("Singh Home Decor", "9876543213", "Jaipur", "Singh Decor"),
            ("Reddy Pharma", "9876543214", "Hyderabad", "Reddy Care"),
        ]

        statuses = list(Lead.Status.choices)
        for project in projects:
            products = list(Product.objects.filter(project=project))
            for i, (name, mobile, city, brand) in enumerate(merchants_data):
                merchant, _ = Merchant.objects.get_or_create(
                    project=project,
                    mobile=mobile,
                    defaults={
                        "name": name, "city": city, "brand_name": brand,
                        "email": f"{name.split()[0].lower()}@{project.slug}.com",
                    },
                )
                product = products[i % len(products)] if products else None
                custom_data = {
                    "gst_number": f"GST{i}000",
                    "business_type": "Retail",
                    "pending_amount": (i + 1) * 2500,
                    "amount_collected": i * 1000,
                }
                lead, lead_created = Lead.objects.get_or_create(
                    project=project, merchant=merchant, bdm=bdm,
                    defaults={
                        "product": product,
                        "status": statuses[i % len(statuses)][0],
                        "follow_up_date": date.today() + timedelta(days=i - 2),
                        "notes": f"Demo lead for {name} under {project.name}",
                        "custom_data": custom_data,
                    },
                )
                if not lead_created and not (lead.custom_data or {}):
                    lead.custom_data = custom_data
                    lead.save(update_fields=["custom_data"])
                form = getattr(project, "custom_form", None)
                if form and (lead.custom_data or {}):
                    FormSubmission.objects.update_or_create(
                        lead=lead,
                        custom_form=form,
                        defaults={
                            "submitted_by": bdm,
                            "answers": lead.custom_data,
                        },
                    )

        for project in projects:
            leads = Lead.objects.filter(project=project, bdm=bdm)[:3]
            for j, lead in enumerate(leads):
                LeadVisit.objects.get_or_create(
                    lead=lead,
                    assigned_to=bdm,
                    scheduled_date=date.today() + timedelta(days=j),
                    defaults={
                        "assigned_by": manager,
                        "visit_type": LeadVisit.VisitType.FOLLOW_UP if j else LeadVisit.VisitType.FIRST,
                        "remarks": f"Visit merchant {lead.merchant.name}",
                        "status": LeadVisit.Status.SCHEDULED,
                    },
                )
                if j == 0:
                    LeadVisit.objects.get_or_create(
                        lead=lead,
                        assigned_to=bdm,
                        scheduled_date=date.today() - timedelta(days=2),
                        defaults={
                            "assigned_by": tl,
                            "visit_type": LeadVisit.VisitType.FIRST,
                            "remarks": "Initial visit completed",
                            "status": LeadVisit.Status.COMPLETED,
                        },
                    )

        self.stdout.write(self.style.SUCCESS(
            "Seeded: admin/manager/tl/bdm + 3 projects + teams + custom forms + 5 leads per project"
        ))

        from api.page_access import ensure_default_page_permissions
        n = ensure_default_page_permissions()
        self.stdout.write(self.style.SUCCESS(f"Page permissions ready ({n} new rows)"))
