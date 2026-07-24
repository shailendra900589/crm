import { VisitsCalendarPage } from "@/components/visits-calendar";
import { RequirePage } from "@/components/role-gate";

export default function Page() {
  return (
    <RequirePage pageKey="visits">
      <VisitsCalendarPage />
    </RequirePage>
  );
}
