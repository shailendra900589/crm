from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from api.models import CustomForm, Lead, LeadVisit, Merchant, Product, Project, Team

User = get_user_model()

DEFAULT_FORM = [
    {"field_id": "gst_number", "label": "GST Number", "type": "text", "required": True},
    {"field_id": "business_type", "label": "Business Type", "type": "dropdown", "required": True, "options": ["Retail", "Wholesale", "Manufacturer"]},
    {"field_id": "annual_revenue", "label": "Annual Revenue", "type": "number", "required": False},
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
        "field_id": "pending_amount",
        "label": "Collection Pending Amount",
        "type": "currency",
        "required": False,
        "currency": "INR",
        "metric_role": "pending_amount",
        "min": 0,
    },
]


class Command(BaseCommand):
    help = "Seed demo users, projects, teams, forms, merchants, and leads"

    def handle(self, *args, **options):
        admin, _ = User.objects.get_or_create(
            username="admin",
            defaults={"role": User.Role.ADMIN, "first_name": "Admin", "email": "admin@crm.local"},
        )
        admin.role = User.Role.ADMIN
        admin.is_active = True
        admin.is_active_user = True
        admin.is_staff = True
        admin.is_superuser = True
        admin.set_password("password123")
        admin.save()

        manager, _ = User.objects.get_or_create(
            username="manager",
            defaults={"role": User.Role.MANAGER, "first_name": "Raj", "reports_to": admin, "email": "manager@crm.local"},
        )
        manager.role = User.Role.MANAGER
        manager.is_active = True
        manager.is_active_user = True
        manager.set_password("password123")
        manager.save()

        tl, _ = User.objects.get_or_create(
            username="tl",
            defaults={"role": User.Role.TL, "first_name": "Priya", "reports_to": manager, "email": "tl@crm.local"},
        )
        tl.role = User.Role.TL
        tl.is_active = True
        tl.is_active_user = True
        tl.set_password("password123")
        tl.save()

        bdm, _ = User.objects.get_or_create(
            username="bdm",
            defaults={"role": User.Role.BDM, "first_name": "Amit", "reports_to": tl, "email": "bdm@crm.local"},
        )
        bdm.role = User.Role.BDM
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
                defaults={"name": name, "description": desc, "color": color, "created_by": admin},
            )
            projects.append(project)
            for pname in product_names:
                Product.objects.get_or_create(
                    project=project,
                    slug=slugify(pname),
                    defaults={"name": pname, "description": f"{pname} for {name}"},
                )
            form, created = CustomForm.objects.get_or_create(
                project=project,
                defaults={"title": f"{name} Onboarding Form", "schema": DEFAULT_FORM, "created_by": admin},
            )
            if not created:
                # Keep title; refresh schema so new money KPI fields are available
                existing_ids = {f.get("field_id") for f in (form.schema or [])}
                merged = list(form.schema or [])
                for field in DEFAULT_FORM:
                    if field["field_id"] not in existing_ids:
                        merged.append(field)
                form.schema = merged or DEFAULT_FORM
                form.save(update_fields=["schema"])
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
                Lead.objects.get_or_create(
                    project=project, merchant=merchant, bdm=bdm,
                    defaults={
                        "product": product,
                        "status": statuses[i % len(statuses)][0],
                        "follow_up_date": date.today() + timedelta(days=i - 2),
                        "notes": f"Demo lead for {name} under {project.name}",
                        "custom_data": {"gst_number": f"GST{i}000", "business_type": "Retail"},
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
