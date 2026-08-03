"use client";

import { PackagesAdminView } from "@/components/packages-admin";
import { RequireRole } from "@/components/role-gate";

export default function Page() {
  return (
    <RequireRole roles={["SuperAdmin"]} fallbackHref="/admin/organizations">
      <PackagesAdminView />
    </RequireRole>
  );
}
