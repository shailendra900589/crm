import { AdminUsersPage } from "@/components/admin-users";
import { RequirePage } from "@/components/role-gate";

export default function TeamMembersPage() {
  return (
    <RequirePage pageKey="team-manage">
      <AdminUsersPage scope="team" />
    </RequirePage>
  );
}
