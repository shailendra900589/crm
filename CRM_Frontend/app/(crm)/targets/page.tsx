import { TargetsPage } from "@/components/targets";
import { RequirePage } from "@/components/role-gate";

export default function Page() {
  return (
    <RequirePage pageKey="targets">
      <TargetsPage />
    </RequirePage>
  );
}
