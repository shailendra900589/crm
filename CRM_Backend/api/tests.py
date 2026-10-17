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


class TeamMemberManagementTests(TestCase):
    """A field role granted "Manage team members" can run its own team, and nothing more."""

    def setUp(self):
        from api.models import Organization
        from api.org_roles import ensure_org_roles

        self.org = Organization.objects.create(
            name="Acme",
            slug="acme",
            email="ops@acme.test",
            status=Organization.Status.ACTIVE,
            docs_verification_status=Organization.DocsVerificationStatus.VERIFIED,
        )
        ensure_org_roles(self.org)
        mk = lambda name, role, boss=None: User.objects.create_user(  # noqa: E731
            username=name, password="password123", role=role, organization=self.org, reports_to=boss
        )
        self.admin = mk("admin", User.Role.ADMIN)
        self.manager = mk("manager", User.Role.MANAGER, self.admin)
        self.tl = mk("tl", User.Role.TL, self.manager)
        self.my_bdm = mk("my_bdm", User.Role.BDM, self.tl)
        self.other_tl = mk("other_tl", User.Role.TL, self.manager)
        self.other_bdm = mk("other_bdm", User.Role.BDM, self.other_tl)
        self.project = Project.objects.create(name="P", slug="p", organization=self.org, created_by=self.admin)
        self.tl.assigned_projects.add(self.project)
        self.client = APIClient()

    def _grant_team_manage(self, base_role):
        from api.models import OrganizationRolePagePermission

        OrganizationRolePagePermission.objects.filter(
            role__organization=self.org, role__is_system=True, role__base_role=base_role, page_key="team-manage"
        ).update(enabled=True)

    def _as(self, user):
        self.client.force_authenticate(user=user)

    def _create_member(self, **extra):
        payload = {"username": "newbie", "password": "password123", "role": User.Role.BDM}
        payload.update(extra)
        return self.client.post("/api/users/", payload, format="json")

    def test_permission_is_off_by_default(self):
        from api.page_access import allowed_pages_for_user

        self.assertNotIn("team-manage", allowed_pages_for_user(self.tl))
        self.assertNotIn("team-manage", allowed_pages_for_user(self.manager))
        self._as(self.tl)
        self.assertEqual(self._create_member().status_code, 403)

    def test_granted_tl_adds_member_into_own_team(self):
        from api.page_access import allowed_pages_for_user

        self._grant_team_manage(User.Role.TL)
        self.assertIn("team-manage", allowed_pages_for_user(self.tl))
        self._as(self.tl)
        res = self._create_member(assigned_projects=[self.project.id])
        self.assertEqual(res.status_code, 201, res.data)
        created = User.objects.get(username="newbie")
        self.assertEqual(created.reports_to_id, self.tl.id)
        self.assertEqual(created.organization_id, self.org.id)
        self.assertEqual(created.role, User.Role.BDM)
        self.assertEqual(list(created.assigned_projects.values_list("id", flat=True)), [self.project.id])

    def test_granted_tl_cannot_create_higher_roles_or_outside_team(self):
        self._grant_team_manage(User.Role.TL)
        self._as(self.tl)
        self.assertEqual(self._create_member(role=User.Role.MANAGER).status_code, 400)
        self.assertEqual(self._create_member(role=User.Role.ADMIN).status_code, 400)
        self.assertEqual(self._create_member(reports_to=self.other_tl.id).status_code, 400)
        self.assertEqual(self._create_member(reports_to=self.my_bdm.id).status_code, 201)

    def test_granted_tl_edits_and_deactivates_only_own_members(self):
        self._grant_team_manage(User.Role.TL)
        self._as(self.tl)
        ok = self.client.patch(f"/api/users/{self.my_bdm.id}/", {"first_name": "Mine"}, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertIn(
            self.client.patch(f"/api/users/{self.other_bdm.id}/", {"first_name": "X"}, format="json").status_code,
            (403, 404),
        )
        self.assertIn(self.client.patch(f"/api/users/{self.tl.id}/", {"first_name": "Me"}, format="json").status_code, (403,))
        self.assertEqual(
            self.client.patch(f"/api/users/{self.my_bdm.id}/", {"role": User.Role.MANAGER}, format="json").status_code,
            400,
        )
        self.assertEqual(self.client.delete(f"/api/users/{self.my_bdm.id}/").status_code, 204)
        self.my_bdm.refresh_from_db()
        self.assertFalse(self.my_bdm.is_active_user)
        self.assertIn(self.client.delete(f"/api/users/{self.other_bdm.id}/").status_code, (403, 404))

    def test_granted_tl_sets_targets_only_for_own_team(self):
        self._grant_team_manage(User.Role.TL)
        self._as(self.tl)
        base = {"year": 2026, "month": 10, "target_confirmed": 5, "target_leads": 20}
        ok = self.client.post("/api/sales-targets/", {**base, "user": self.my_bdm.id}, format="json")
        self.assertEqual(ok.status_code, 201, ok.data)
        denied = self.client.post("/api/sales-targets/", {**base, "user": self.other_bdm.id}, format="json")
        self.assertEqual(denied.status_code, 403)

    def test_granted_custom_bdm_role_can_run_a_team(self):
        from api.models import OrganizationRole
        from api.org_roles import set_role_pages

        lead_role = OrganizationRole.objects.create(
            organization=self.org, name="Field Captain", slug="captain", base_role=User.Role.BDM
        )
        set_role_pages(lead_role, [{"page_key": "dashboard", "enabled": True}, {"page_key": "team-manage", "enabled": True}])
        captain = User.objects.create_user(
            username="captain", password="password123", role=User.Role.BDM,
            organization=self.org, reports_to=self.tl, organization_role=lead_role,
        )
        self._as(captain)
        res = self._create_member(username="cadet")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(User.objects.get(username="cadet").reports_to_id, captain.id)
        self.assertEqual(self._create_member(username="cadet2", role=User.Role.TL).status_code, 400)

    def test_team_manager_role_picker_is_scoped(self):
        self._as(self.tl)
        self.assertEqual(self.client.get("/api/admin/roles/").status_code, 403)
        self._grant_team_manage(User.Role.TL)
        res = self.client.get("/api/admin/roles/")
        self.assertEqual(res.status_code, 200)
        bases = {r["base_role"] for r in res.data["results"]}
        self.assertTrue(bases)
        self.assertTrue(bases <= {User.Role.BDM, User.Role.OPS})

    def test_admin_cannot_create_reporting_cycle(self):
        self._as(self.admin)
        res = self.client.patch(f"/api/users/{self.manager.id}/", {"reports_to": self.my_bdm.id}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_admin_still_manages_everyone(self):
        self._as(self.admin)
        self.assertEqual(self._create_member(role=User.Role.MANAGER).status_code, 201)
        res = self.client.patch(f"/api/users/{self.other_bdm.id}/", {"first_name": "Edited"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
