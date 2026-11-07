import { isAdmin } from "@/lib/ops/auth";
import { fmtSlot } from "@/lib/ops/dates";
import { missingLabels, platformLabel } from "@/lib/ops/insight-fields";
import { buildReport } from "@/lib/ops/report";
import { loadBundle } from "@/lib/ops/service";

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
  const metricKeys = ["views", "viewers", "avgWatchSec", "follows", "likes", "comments", "shares", "saves", "newViewerPct", "nonFollowerPct"] as const;
  const metricLabels = ["閲覧数・視聴数", "閲覧者", "平均再生時間(秒)", "フォロー", "いいね", "コメント", "シェア", "保存", "新しい視聴者(%)", "フォロワー以外(%)"];
  const dist = (d?: { label: string; pct: number }[]) => (d ?? []).map((x) => `${x.label} ${x.pct}%`).join(" / ");
  const header = ["発信者", "アカウント", "フォロワー", "媒体", "撮影日時", "投稿日", "投稿URL", ...metricLabels, "反応数", "ER", "閲覧ソース", "年齢", "性別", "足りない項目"];
  const lines = r.rows.map((x) => [
    x.creator.name,
    x.creator.account,
    x.creator.followers,
    x.platform ? platformLabel[x.platform] : "",
    x.slot ? fmtSlot(x.slot) : "",
    x.a.plannedPostDate,
    x.a.postUrl,
    ...metricKeys.map((k) => x.insight?.metrics[k]),
    x.reactions,
    x.er === undefined ? "" : `${(x.er * 100).toFixed(2)}%`,
    dist(x.insight?.dists.sources),
    dist(x.insight?.dists.age),
    dist(x.insight?.dists.gender),
    x.insight ? missingLabels(x.insight).join("・") : "未提出",
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
