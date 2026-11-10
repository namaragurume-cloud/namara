import type { Assignment, Creator, Insight } from "./types";

/**
 * 予想リーチ（このツールに集まったインサイトから推計）
 * - リーチ＝Instagram は「閲覧者」（届いたアカウント数。なければ閲覧数）、TikTok は「総視聴数」
 * - 実績がある人：直近10投稿の中央値。3投稿以上なら25〜75%の幅、それ未満は±30%の幅
 * - 実績がない人：ネットワーク全体の「リーチ÷フォロワー数」の中央値 × その人のフォロワー数（参考値。幅は±50%）
 * 成果を保証するものではないので、表示するときは必ず「推計」と書く。
 */

export type ReachEstimate = {
  value: number;
  low: number;
  high: number;
  /** history＝本人の実績から / followers＝フォロワー数から推計（参考値） */
  basis: "history" | "followers";
  /** 推計に使った本人の投稿数 */
  posts: number;
};

export type ReachModel = {
  byCreator: Map<string, number[]>;
  /** プラットフォームごと（instagram / tiktok / all）のリーチ÷フォロワー数の中央値 */
  ratio: Partial<Record<"instagram" | "tiktok" | "all", number>>;
};

const RECENT = 10;
const MIN_RATIO_SAMPLES = 5;

export function reachOf(i?: Insight): number | undefined {
  if (!i) return undefined;
  const v = i.platform === "instagram" ? (i.metrics.viewers ?? i.metrics.views) : i.metrics.views;
  return v && v > 0 ? v : undefined;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const platformKey = (p?: string): "instagram" | "tiktok" | undefined => (p && /tiktok/i.test(p) ? "tiktok" : p && /instagram/i.test(p) ? "instagram" : undefined);

export function buildReachModel(assignments: Assignment[], creators: Creator[]): ReachModel {
  const followers = new Map(creators.map((c) => [c.id, c.followers]));
  const posts = assignments
    .map((a) => ({ a, reach: reachOf(a.insight) }))
    .filter((x): x is { a: Assignment; reach: number } => x.reach !== undefined)
    .sort((x, y) => (y.a.plannedPostDate ?? y.a.insight!.submittedAt).localeCompare(x.a.plannedPostDate ?? x.a.insight!.submittedAt));
  const byCreator = new Map<string, number[]>();
  const ratios: Record<"instagram" | "tiktok" | "all", number[]> = { instagram: [], tiktok: [], all: [] };
  for (const { a, reach } of posts) {
    byCreator.set(a.creatorId, [...(byCreator.get(a.creatorId) ?? []), reach]);
    const f = followers.get(a.creatorId);
    if (f && f > 0) {
      ratios[a.insight!.platform].push(reach / f);
      ratios.all.push(reach / f);
    }
  }
  const ratio: ReachModel["ratio"] = {};
  for (const k of ["instagram", "tiktok", "all"] as const) {
    if (ratios[k].length >= MIN_RATIO_SAMPLES) ratio[k] = quantile([...ratios[k]].sort((x, y) => x - y), 0.5);
  }
  return { byCreator, ratio };
}

export function estimateReach(c: Pick<Creator, "id" | "followers" | "platform">, m: ReachModel): ReachEstimate | undefined {
  const hist = (m.byCreator.get(c.id) ?? []).slice(0, RECENT);
  if (hist.length > 0) {
    const s = [...hist].sort((x, y) => x - y);
    const value = quantile(s, 0.5);
    const [low, high] = s.length >= 3 ? [quantile(s, 0.25), quantile(s, 0.75)] : [value * 0.7, value * 1.3];
    return { value: Math.round(value), low: Math.round(low), high: Math.round(high), basis: "history", posts: hist.length };
  }
  const p = platformKey(c.platform);
  const r = (p && m.ratio[p]) ?? m.ratio.all;
  if (!c.followers || !r) return undefined;
  const value = c.followers * r;
  return { value: Math.round(value), low: Math.round(value * 0.5), high: Math.round(value * 1.5), basis: "followers", posts: 0 };
}

/** 1.2万 / 8,400 のような表示（概数） */
export function fmtReach(n: number): string {
  if (n >= 10000) return `${(Math.round(n / 1000) / 10).toLocaleString("ja-JP")}万`;
  if (n >= 1000) return (Math.round(n / 100) * 100).toLocaleString("ja-JP");
  return Math.round(n).toLocaleString("ja-JP");
}

export const fmtReachRange = (e: Pick<ReachEstimate, "low" | "high">) => `${fmtReach(e.low)}〜${fmtReach(e.high)}人`;
