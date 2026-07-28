"use client";

import { AdminAuditPage } from "@/components/admin-audit";
import { RequireRole } from "@/components/role-gate";

export default function Page() {
  return (
    <RequireRole roles={["Admin"]} fallbackHref="/admin/organizations">
      <AdminAuditPage />
    </RequireRole>
  );
}
