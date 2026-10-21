import type { Metadata } from "next";

import { ReportsView } from "@/components/reports/reports-view";

export const metadata: Metadata = { title: "AI分析レポート" };

export default function ReportsPage() {
  return <ReportsView />;
}
