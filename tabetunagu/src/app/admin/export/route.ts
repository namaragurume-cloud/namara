import { getViewer } from "@/server/auth/viewer";
import { periodRange, type Period } from "@/server/services/admin";
import { exportOrdersCsv, exportStoresCsv } from "@/server/services/ops";

/**
 * PoC 結果の CSV（管理者のみ）。?type=orders|stores&period=month|30d|all
 * 個人情報（ユーザー ID・表示名・IP など）は含めない。
 */
export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return new Response(null, { status: 404 });
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const p = url.searchParams.get("period");
  const period: Period = p === "30d" || p === "all" ? p : "month";
  const { from, to } = periodRange(period);
  let csv: string;
  if (type === "orders") csv = await exportOrdersCsv(from, to);
  else if (type === "stores") csv = await exportStoresCsv(from, to);
  else return new Response(null, { status: 404 });
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tabetunagu-${type}-${period}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
