"use client";

import { AdminPagePermissions } from "@/components/admin-page-permissions";
import { RequireRole } from "@/components/role-gate";

export default function AdminPermissionsPage() {
  return (
    <RequireRole roles={["Admin"]} pageKey="admin.permissions" fallbackHref="/admin">
      <AdminPagePermissions />
    </RequireRole>
  );
}
