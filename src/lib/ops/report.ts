import { fmtDateLong } from "./dates";
import { isComplete } from "./insight-fields";
import type { Assignment, Campaign, Creator, Dist, Insight, MetricKey, Platform, Slot } from "./types";

/**
 * レポートの集計。サーバー・クライアントどちらからも使える純粋な関数だけを置きます。
 * 反応数＝いいね＋コメント＋保存＋シェア、エンゲージメント率（ER）＝反応数÷閲覧数（媒体をそろえて比べるため閲覧数で割る）。
 */

export type PostRow = {
  a: Assignment;
  creator: Creator;
  slot?: Slot;
  platform?: Platform;
  insight?: Insight;
  views?: number;
  reactions?: number;
  er?: number;
};

export type PlatformAgg = {
  platform: Platform;
  posts: PostRow[];
  views: number;
  viewers: number;
  follows: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reactions: number;
  er?: number;
  /** 投稿の単純平均 */
  avgWatchSec?: number;
  /** 閲覧数で重み付けした平均 */
  nonFollowerPct?: number;
  newViewerPct?: number;
  sources: Dist;
  /** 反応数が写っている投稿だけで計算したか */
  hasReactions: boolean;
};

export type Report = {
  /** 撮影日が確定した依頼すべて */
  rows: PostRow[];
  /** 数値のある投稿（閲覧数の多い順） */
  posts: PostRow[];
  submitted: number;
  total: number;
  incomplete: PostRow[];
  byPlatform: Partial<Record<Platform, PlatformAgg>>;
  views: number;
  reactions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  follows: number;
  er?: number;
  nonFollowerPct?: number;
  age: Dist;
  gender: Dist;
  followers: number;
  top: PostRow[];
  period: string;
};

const m = (i: Insight | undefined, k: MetricKey) => i?.metrics[k];
const sum = (rows: PostRow[], k: MetricKey) => rows.reduce((n, r) => n + (m(r.insight, k) ?? 0), 0);

function reactionsOf(i: Insight): number | undefined {
  const parts = (["likes", "comments", "shares", "saves"] as const).map((k) => i.metrics[k]);
  if (parts.every((v) => v === undefined)) return undefined;
  return parts.reduce<number>((n, v) => n + (v ?? 0), 0);
}

function weighted(rows: PostRow[], k: MetricKey): number | undefined {
  let w = 0;
  let t = 0;
  for (const r of rows) {
    const v = m(r.insight, k);
    if (v === undefined || !r.views) continue;
    w += r.views;
    t += v * r.views;
  }
  return w > 0 ? t / w : undefined;
}

/** 内訳を閲覧数で重み付けして合算 */
function mergeDist(rows: PostRow[], pick: (i: Insight) => Dist | undefined, norm: (label: string) => string, order?: string[]): Dist {
  const acc = new Map<string, number>();
  let w = 0;
  for (const r of rows) {
    const d = r.insight && pick(r.insight);
    if (!d?.length || !r.views) continue;
    w += r.views;
    for (const x of d) acc.set(norm(x.label), (acc.get(norm(x.label)) ?? 0) + x.pct * r.views);
  }
  if (w === 0) return [];
  const out = [...acc].map(([label, t]) => ({ label, pct: t / w }));
  return order ? out.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)) : out.sort((a, b) => b.pct - a.pct);
}

export const AGE_ORDER = ["〜17", "18-24", "25-34", "35-44", "45-54", "55+"];

/** InstagramとTikTokで区切りが違うので、共通の区切りにそろえる */
function normAge(label: string): string {
  const s = label.replace(/\s/g, "").replace(/[〜~ー－]/g, "-");
  if (/^13-17$|^-?17$/.test(s)) return "〜17";
  if (/^(55-64|65\+|55\+)$/.test(s)) return "55+";
  return s;
}

function normGender(label: string): string {
  if (/男|male/i.test(label) && !/female/i.test(label)) return "男性";
  if (/女|female/i.test(label)) return "女性";
  return "その他";
}

function aggregate(platform: Platform, rows: PostRow[]): PlatformAgg {
  const reactRows = rows.filter((r) => r.reactions !== undefined);
  const reactions = reactRows.reduce((n, r) => n + (r.reactions ?? 0), 0);
  const reactViews = reactRows.reduce((n, r) => n + (r.views ?? 0), 0);
  const watch = rows.map((r) => m(r.insight, "avgWatchSec")).filter((v): v is number => v !== undefined);
  return {
    platform,
    posts: rows,
    views: sum(rows, "views"),
    viewers: sum(rows, "viewers"),
    follows: sum(rows, "follows"),
    likes: sum(rows, "likes"),
    comments: sum(rows, "comments"),
    shares: sum(rows, "shares"),
    saves: sum(rows, "saves"),
    reactions,
    er: reactViews > 0 ? reactions / reactViews : undefined,
    avgWatchSec: watch.length ? watch.reduce((a, b) => a + b, 0) / watch.length : undefined,
    nonFollowerPct: weighted(rows, "nonFollowerPct"),
    newViewerPct: weighted(rows, "newViewerPct"),
    sources: mergeDist(rows, (i) => i.dists.sources, (l) => l.trim()),
    hasReactions: reactRows.length > 0,
  };
}

export function buildReport(input: { campaign: Campaign; rows: { a: Assignment; creator: Creator }[] }): Report {
  const { campaign } = input;
  const rows: PostRow[] = input.rows
    .filter((r) => r.a.status === "accepted" && r.a.confirmedSlotId)
    .map(({ a, creator }) => {
      const insight = a.insight;
      const views = m(insight, "views");
      const reactions = insight ? reactionsOf(insight) : undefined;
      return {
        a,
        creator,
        slot: campaign.slots.find((s) => s.id === a.confirmedSlotId),
        platform: insight?.platform ?? a.platform,
        insight,
        views,
        reactions,
        er: views && reactions !== undefined ? reactions / views : undefined,
      };
    });
  const posts = rows.filter((r) => r.insight && r.views !== undefined).sort((x, y) => (y.views ?? 0) - (x.views ?? 0));
  const byPlatform: Partial<Record<Platform, PlatformAgg>> = {};
  for (const p of ["instagram", "tiktok"] as const) {
    const list = posts.filter((r) => r.platform === p);
    if (list.length) byPlatform[p] = aggregate(p, list);
  }
  const reactRows = posts.filter((r) => r.reactions !== undefined);
  const reactions = reactRows.reduce((n, r) => n + (r.reactions ?? 0), 0);
  const reactViews = reactRows.reduce((n, r) => n + (r.views ?? 0), 0);
  const dates = posts.map((r) => r.a.plannedPostDate).filter((d): d is string => Boolean(d)).sort();
  const period =
    campaign.reportPeriod?.trim() ||
    (dates.length ? (dates[0] === dates.at(-1) ? fmtDateLong(dates[0]) : `${fmtDateLong(dates[0])}〜${fmtDateLong(dates.at(-1))}`) : "");
  return {
    rows,
    posts,
    submitted: posts.length,
    total: rows.length,
    incomplete: rows.filter((r) => !isComplete(r.insight)),
    byPlatform,
    views: sum(posts, "views"),
    reactions,
    likes: sum(posts, "likes"),
    comments: sum(posts, "comments"),
    shares: sum(posts, "shares"),
    saves: sum(posts, "saves"),
    follows: sum(posts, "follows"),
    er: reactViews > 0 ? reactions / reactViews : undefined,
    nonFollowerPct: weighted(posts, "nonFollowerPct"),
    age: mergeDist(posts, (i) => i.dists.age, normAge, AGE_ORDER),
    gender: mergeDist(posts, (i) => i.dists.gender, normGender, ["女性", "男性", "その他"]).filter((g) => g.pct >= 0.05),
    followers: rows.reduce((n, r) => n + (r.creator.followers ?? 0), 0),
    top: [...reactRows].sort((x, y) => (y.reactions ?? 0) - (x.reactions ?? 0)).slice(0, 3),
    period,
  };
}

export const pct = (ratio?: number) => (ratio === undefined ? "-" : `${(ratio * 100).toFixed(2)}%`);
export const pct1 = (v?: number) => (v === undefined ? "-" : `${v.toFixed(1)}%`);
export const sec = (v?: number) => (v === undefined ? "-" : `${v.toFixed(1)}秒`);

/** 「見出し｜説明」形式の提案テキストを分解 */
export function parseProposals(text?: string): { title: string; body: string }[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [title, ...rest] = l.split(/[｜|]/);
      return { title: title.trim(), body: rest.join("｜").trim() };
    });
}

export const lines = (text?: string) =>
  (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[・\-\s●]+/, "").trim())
    .filter(Boolean);
