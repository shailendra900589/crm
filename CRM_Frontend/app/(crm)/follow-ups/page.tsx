import { FollowUpsPage } from "@/components/follow-ups";
import { RequirePage } from "@/components/role-gate";

export default function Page() {
  return (
    <RequirePage pageKey="follow-ups">
      <FollowUpsPage />
    </RequirePage>
  );
}
