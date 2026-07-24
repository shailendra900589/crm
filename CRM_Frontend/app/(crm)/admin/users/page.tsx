"use client";

import { AdminUsersPage } from "@/components/admin-users";
import { RequireRole } from "@/components/role-gate";

export default function Page() {
  return (
    <RequireRole roles={["Admin"]}>
      <AdminUsersPage />
    </RequireRole>
  );
}
