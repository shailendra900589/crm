import { ProfilePage } from "@/components/profile";
import { RequirePage } from "@/components/role-gate";

export default function Page() {
  return (
    <RequirePage pageKey="profile">
      <ProfilePage />
    </RequirePage>
  );
}
