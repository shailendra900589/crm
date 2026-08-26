"use client";

import { AdminRolesPage } from "@/components/admin-roles";
import { RequireRole } from "@/components/role-gate";

export default function AdminPermissionsPage() {
  return (
    <RequireRole roles={["Admin"]} pageKey="admin.permissions" fallbackHref="/admin">
      <AdminRolesPage />
    </RequireRole>
  );
}
