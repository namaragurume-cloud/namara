import type { DistKey, Insight, MetricKey, Platform } from "./types";

/**
 * 媒体ごとに集めるインサイト項目。required の項目がスクショに写っていなければ「不足」として発信者に連絡します。
 * サーバー・クライアントの両方から使います。
 */

export type FieldDef =
  | { key: MetricKey; label: string; kind: "count" | "seconds" | "percent"; required: boolean; videoOnly?: boolean }
  | { key: DistKey; label: string; kind: "dist"; required: boolean };

export const platformLabel: Record<Platform, string> = { instagram: "Instagram", tiktok: "TikTok" };

export const insightFields: Record<Platform, FieldDef[]> = {
  instagram: [
    { key: "views", label: "閲覧数", kind: "count", required: true },
    { key: "viewers", label: "閲覧者", kind: "count", required: true },
    { key: "avgWatchSec", label: "平均再生時間", kind: "seconds", required: true, videoOnly: true },
    { key: "follows", label: "フォロー数", kind: "count", required: true },
    { key: "sources", label: "閲覧数の上位のソース", kind: "dist", required: true },
    { key: "nonFollowerPct", label: "フォロワー以外の割合", kind: "percent", required: true },
    { key: "age", label: "年齢", kind: "dist", required: true },
    { key: "gender", label: "性別", kind: "dist", required: true },
    // 写っていればレポートに使う（必須ではない）
    { key: "likes", label: "いいね", kind: "count", required: false },
    { key: "comments", label: "コメント", kind: "count", required: false },
    { key: "shares", label: "シェア", kind: "count", required: false },
    { key: "saves", label: "保存", kind: "count", required: false },
  ],
  tiktok: [
    { key: "views", label: "総視聴数", kind: "count", required: true },
    { key: "likes", label: "いいね", kind: "count", required: true },
    { key: "comments", label: "コメント", kind: "count", required: true },
    { key: "shares", label: "シェア", kind: "count", required: true },
    { key: "saves", label: "保存", kind: "count", required: true },
    { key: "newViewerPct", label: "新しい視聴者の割合", kind: "percent", required: true },
    { key: "nonFollowerPct", label: "非フォロワーの割合", kind: "percent", required: true },
    { key: "gender", label: "性別", kind: "dist", required: true },
    { key: "age", label: "年齢", kind: "dist", required: true },
    { key: "avgWatchSec", label: "平均視聴時間", kind: "seconds", required: false },
  ],
};

/** スクショの撮り方（依頼文・発信者ページに表示） */
export const screenshotGuide: Record<Platform, string[]> = {
  instagram: [
    "投稿の「インサイトを見る」→「概要」（閲覧数・閲覧者・平均再生時間・フォロー数）",
    "同じ画面の「閲覧数の上位のソース」",
    "「オーディエンス」の「フォロワー／フォロワー以外」",
    "「オーディエンス詳細」の「年齢」と「性別」（タブを切り替えて2枚）",
  ],
  tiktok: [
    "投稿の「アナリティクス」→ 上部の数字（再生・いいね・コメント・シェア・保存）",
    "「視聴者」タブの「視聴者の種類」（新しい視聴者・非フォロワー）",
    "同じタブの「性別」と「年齢」",
  ],
};

function has(i: Pick<Insight, "metrics" | "dists">, f: FieldDef): boolean {
  if (f.kind === "dist") return (i.dists[f.key]?.length ?? 0) > 0;
  const v = i.metrics[f.key];
  return typeof v === "number" && Number.isFinite(v);
}

/** 必須なのに値がない項目のキー */
export function missingKeys(i: Pick<Insight, "platform" | "metrics" | "dists" | "isVideo">): string[] {
  return insightFields[i.platform]
    .filter((f) => f.required && !(f.kind !== "dist" && f.videoOnly && i.isVideo === false))
    .filter((f) => !has(i, f))
    .map((f) => f.key);
}

export function fieldLabel(platform: Platform, key: string): string {
  return insightFields[platform].find((f) => f.key === key)?.label ?? key;
}

export const missingLabels = (i: Pick<Insight, "platform" | "missing">) => i.missing.map((k) => fieldLabel(i.platform, k));

export function isComplete(i?: Insight): boolean {
  return Boolean(i && i.missing.length === 0);
}

export function fmtMetric(kind: FieldDef["kind"], v?: number): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-";
  if (kind === "seconds") return `${v.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}秒`;
  if (kind === "percent") return `${v.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}%`;
  return v.toLocaleString("ja-JP");
}

export const fmtDist = (d?: { label: string; pct: number }[]) =>
  d?.length ? d.map((x) => `${x.label} ${x.pct.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}%`).join("・") : "-";

/** 「フィード 72.7」のような行の入力を内訳に変換（管理画面の手入力用） */
export function parseDistText(text: string): { label: string; pct: number }[] {
  return text
    .split(/\r?\n|[、,]/)
    .map((l) => l.trim().match(/^(.+?)[\s:：]+([\d.]+)\s*%?$/))
    .flatMap((m) => (m && Number.isFinite(Number(m[2])) ? [{ label: m[1].trim(), pct: Number(m[2]) }] : []));
}
