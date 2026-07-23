import { LeadsView } from "@/components/leads";
import { Suspense } from "react";

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-slate-100" />}>
      <LeadsView />
    </Suspense>
  );
}
