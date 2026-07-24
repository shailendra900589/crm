import { LeadsView } from "@/components/leads";
import { RequirePage } from "@/components/role-gate";
import { Suspense } from "react";

export default function LeadsPage() {
  return (
    <RequirePage pageKey="leads">
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-slate-100" />}>
        <LeadsView />
      </Suspense>
    </RequirePage>
  );
}
