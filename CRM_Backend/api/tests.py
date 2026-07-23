from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import Lead, Project

User = get_user_model()


class RoleCascadeTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="admin", password="password123", role=User.Role.ADMIN)
        self.manager = User.objects.create_user(
            username="manager", password="password123", role=User.Role.MANAGER, reports_to=self.admin
        )
        self.bdm1 = User.objects.create_user(
            username="bdm1", password="password123", role=User.Role.BDM, reports_to=self.manager
        )
        self.bdm2 = User.objects.create_user(
            username="bdm2", password="password123", role=User.Role.BDM, reports_to=self.manager
        )
        self.project = Project.objects.create(name="Test", slug="test", created_by=self.admin)
        self.manager.assigned_projects.add(self.project)
        self.bdm1.assigned_projects.add(self.project)
        self.bdm2.assigned_projects.add(self.project)
        self.client = APIClient()

    def _login(self, username):
        res = self.client.post("/api/auth/login/", {"username": username, "password": "password123"}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")

    def test_bdm_cannot_see_other_bdm_leads(self):
        Lead.objects.create(
            project=self.project,
            merchant_id=self._merchant("A", "111"),
            bdm=self.bdm1,
        )
        Lead.objects.create(
            project=self.project,
            merchant_id=self._merchant("B", "222"),
            bdm=self.bdm2,
        )
        self._login("bdm1")
        res = self.client.get(f"/api/leads/?project={self.project.id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)

    def test_bdm_inherits_manager_project_only(self):
        other = Project.objects.create(name="Other", slug="other", created_by=self.admin)
        # Manager only has self.project — bdm1 has no direct assignment
        self.bdm1.assigned_projects.clear()
        Lead.objects.create(project=self.project, merchant_id=self._merchant("A", "111"), bdm=self.bdm1)
        Lead.objects.create(project=other, merchant_id=self._merchant("B", "222"), bdm=self.bdm1)

        self._login("bdm1")
        projects = self.client.get("/api/projects/")
        self.assertEqual(projects.status_code, 200)
        ids = {p["id"] for p in projects.data}
        self.assertIn(self.project.id, ids)
        self.assertNotIn(other.id, ids)

        leads = self.client.get("/api/leads/")
        self.assertEqual(leads.status_code, 200)
        self.assertEqual(leads.data["count"], 1)

    def test_admin_can_access_admin_dashboard(self):
        self._login("admin")
        res = self.client.get("/api/admin/dashboard/")
        self.assertEqual(res.status_code, 200)

    def test_manager_blocked_from_admin_dashboard(self):
        self._login("manager")
        res = self.client.get("/api/admin/dashboard/")
        self.assertEqual(res.status_code, 403)

    def test_admin_can_create_user(self):
        self._login("admin")
        res = self.client.post(
            "/api/users/",
            {
                "username": "newmgr",
                "password": "password123",
                "role": User.Role.MANAGER,
                "reports_to": self.admin.id,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)

    def _merchant(self, name, mobile):
        from api.models import Merchant
        return Merchant.objects.create(project=self.project, name=name, mobile=mobile).id
