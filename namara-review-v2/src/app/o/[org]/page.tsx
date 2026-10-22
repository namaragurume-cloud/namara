import { redirect } from "next/navigation";

export default async function OrganizationHome({ params }: PageProps<"/o/[org]">) {
  const { org } = await params;
  redirect(`/o/${org}/dashboard`);
}
