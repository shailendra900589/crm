import { PipelineBoard } from "@/components/pipeline";
import { RequirePage } from "@/components/role-gate";

export default function Page() {
  return (
    <RequirePage pageKey="pipeline">
      <PipelineBoard />
    </RequirePage>
  );
}
