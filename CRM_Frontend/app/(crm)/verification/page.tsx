"use client";

import { VerificationQueueView } from "@/components/verification-queue";
import { RequirePage } from "@/components/role-gate";

export default function VerificationPage() {
  return (
    <RequirePage pageKey="verification">
      <VerificationQueueView />
    </RequirePage>
  );
}
