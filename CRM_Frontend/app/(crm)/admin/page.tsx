"use client";

import { AdminPanel } from "@/components/admin";
import { RequireRole } from "@/components/role-gate";

export default function AdminPage() {
  return (
    <RequireRole roles={["Admin"]}>
      <AdminPanel />
    </RequireRole>
  );
}
