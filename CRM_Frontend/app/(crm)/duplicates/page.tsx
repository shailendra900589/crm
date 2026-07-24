import { DuplicatesPage } from "@/components/duplicates";
import { RequirePage } from "@/components/role-gate";

export default function Page() {
  return (
    <RequirePage pageKey="duplicates">
      <DuplicatesPage />
    </RequirePage>
  );
}
