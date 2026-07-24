import { ReportsPage } from "@/components/reports";
import { RequirePage } from "@/components/role-gate";

export default function Page() {
  return (
    <RequirePage pageKey="reports">
      <ReportsPage />
    </RequirePage>
  );
}
