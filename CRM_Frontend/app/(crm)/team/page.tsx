import { TeamView } from "@/components/team";
import { RequirePage } from "@/components/role-gate";

export default function TeamPage() {
  return (
    <RequirePage pageKey="team">
      <TeamView />
    </RequirePage>
  );
}
