"use client";

import { AdminProjectDetailPage } from "@/components/admin-project-detail";
import { RequireRole } from "@/components/role-gate";

export default function Page({ params }: { params: { id: string } }) {
  return (
    <RequireRole roles={["Admin", "SuperAdmin"]}>
      <AdminProjectDetailPage projectId={Number(params.id)} />
    </RequireRole>
  );
}
