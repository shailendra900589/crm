"use client";

import { OrganizationsAdminView } from "@/components/organizations-admin";
import { RequireRole } from "@/components/role-gate";

export default function OrganizationsPage() {
  return (
    <RequireRole roles={["SuperAdmin"]} fallbackHref="/admin">
      <OrganizationsAdminView />
    </RequireRole>
  );
}
