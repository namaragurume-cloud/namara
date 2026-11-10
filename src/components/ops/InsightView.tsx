import { fieldLabel, fmtDist, fmtMetric, insightFields, platformLabel } from "@/lib/ops/insight-fields";
import type { Insight } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

/** 読み取った値の一覧（不足は赤で表示） */
export function InsightView({ insight, showOptional = true }: { insight: Insight; showOptional?: boolean }) {
  const missing = new Set(insight.missing);
  const fields = insightFields[insight.platform].filter((f) => f.required || showOptional);
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-muted">
        {platformLabel[insight.platform]}
        {insight.source === "ai" ? "・スクショから自動で読み取り" : "・担当者が入力"}
      </p>
      <dl className="divide-y divide-line rounded-xl border border-line text-sm">
        {fields.map((f) => {
          const isMissing = missing.has(f.key);
          const value = f.kind === "dist" ? fmtDist(insight.dists[f.key]) : fmtMetric(f.kind, insight.metrics[f.key]);
          return (
            <div key={f.key} className={cn("flex gap-3 px-3 py-2", isMissing && "bg-rose-50")}>
              <dt className={cn("w-32 shrink-0 text-xs font-bold", isMissing ? "text-rose-700" : "text-muted")}>{f.label}</dt>
              <dd className={cn("min-w-0 flex-1 break-words", isMissing ? "font-bold text-rose-700" : value === "-" && "text-muted")}>
                {isMissing ? "写っていません" : value === "-" && f.kind !== "dist" && f.videoOnly && insight.isVideo !== true ? (insight.isVideo === false ? "（写真の投稿のため対象外）" : "（動画の投稿のみ）") : value}
              </dd>
            </div>
          );
        })}
      </dl>
      {insight.missing.length > 0 && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">
          足りない項目：{insight.missing.map((k) => fieldLabel(insight.platform, k)).join("、")}
        </p>
      )}
    </div>
  );
}
