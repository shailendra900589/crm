"use client";

import { FormBuilder } from "@/components/form-builder";
import { RequireRole } from "@/components/role-gate";

export default function AdminFormsPage() {
  return (
    <RequireRole roles={["Admin"]} pageKey="admin.forms" fallbackHref="/admin">
      <FormBuilder />
    </RequireRole>
  );
}
