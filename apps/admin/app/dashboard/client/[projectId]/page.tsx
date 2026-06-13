import { redirect } from "next/navigation";

export default async function ClientAdminRedirect({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  redirect(`/dashboard/client/${projectId}/faqs`);
}
