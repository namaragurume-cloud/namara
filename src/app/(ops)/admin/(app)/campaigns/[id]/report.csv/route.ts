import { isAdmin } from "@/lib/ops/auth";
import { fmtSlot } from "@/lib/ops/dates";
import { buildReport, loadBundle } from "@/lib/ops/service";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  // Excel で数式として解釈されないようにする
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const b = await loadBundle(id);
  if (!b) return new Response("Not found", { status: 404 });
  const r = buildReport(b);
  const header = ["発信者", "アカウント", "フォロワー", "撮影日時", "投稿予定日", "投稿URL", "再生数", "リーチ", "いいね", "コメント", "保存", "シェア", "プロフィールアクセス", "フォロー", "エンゲージメント率"];
  const lines = r.rows.map((x) => [
    x.creator.name,
    x.creator.account,
    x.creator.followers,
    x.slot ? fmtSlot(x.slot) : "",
    x.postDate,
    x.postUrl,
    x.insight?.views,
    x.insight?.reach,
    x.insight?.likes,
    x.insight?.comments,
    x.insight?.saves,
    x.insight?.shares,
    x.insight?.profileVisits,
    x.insight?.follows,
    x.rate === undefined ? "" : `${(x.rate * 100).toFixed(1)}%`,
  ]);
  const csv = "﻿" + [header, ...lines].map((l) => l.map(cell).join(",")).join("\r\n");
  const name = encodeURIComponent(`${b.restaurant?.name ?? "report"}_${b.campaign.title}.csv`);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report.csv"; filename*=UTF-8''${name}`,
    },
  });
}
