import { AdminProjectDetailPage } from "@/components/admin-project-detail";

export default function Page({ params }: { params: { id: string } }) {
  return <AdminProjectDetailPage projectId={Number(params.id)} />;
}
