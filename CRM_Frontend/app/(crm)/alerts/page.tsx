import { AlertsPage } from "@/components/alerts";
import { RequirePage } from "@/components/role-gate";

export default function Page() {
  return (
    <RequirePage pageKey="alerts">
      <AlertsPage />
    </RequirePage>
  );
}
