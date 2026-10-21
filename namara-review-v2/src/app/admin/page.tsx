import type { Metadata } from "next";

import { AdminView } from "@/components/admin/admin-view";

export const metadata: Metadata = { title: "運営管理" };

export default function AdminPage() {
  return <AdminView />;
}
