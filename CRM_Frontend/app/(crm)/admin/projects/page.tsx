"use client";

import { AdminProjectsPage } from "@/components/admin-projects";
import { RequireRole } from "@/components/role-gate";

export default function Page() {
  return (
    <RequireRole roles={["Admin"]}>
      <AdminProjectsPage />
    </RequireRole>
  );
}
