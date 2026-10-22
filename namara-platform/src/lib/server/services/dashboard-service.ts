/**
 * NAMARA REVIEW（店舗向け）と運営ダッシュボードのデータ取得。
 * 店舗向けには自店の数値と、個人を特定できない匿名集計だけを返す。
 */
import "server-only";
import { areaLabel, featureLabel, genreLabel, sceneLabel, type AreaId } from "@/lib/shared/dictionaries";
import type { InteractionEvent, Review, SearchLog, Store } from "@/lib/shared/types";
import {
  compareBreakdowns,
  comparablePeriods,
  filterLogs,
  findUnderservedThemes,
  MIN_CELL_SESSIONS,
  summarizeDemand,
} from "@/lib/analytics/aggregate";
import { buildActionSuggestions } from "@/lib/analytics/insights";
import { getDb, spentByCampaign, type Db } from "../db";
import { assertOperator, assertStoreAccess, ForbiddenError, type Actor } from "../authz";

type Period = { from: Date; to: Date };

const inPeriod = (iso: string, p: Period) => {
  const t = new Date(iso).getTime();
  return t >= p.from.getTime() && t < p.to.getTime();
};

function storeOrThrow(db: Db, storeId: string): Store {
  const store = db.stores.find((s) => s.id === storeId);
  if (!store) throw new ForbiddenError("店舗が見つかりません");
  return store;
}

export type ExposureStats = { impressions: number; detail: number; map: number; reservation: number; saved: number };

function exposure(events: readonly InteractionEvent[], storeId: string, p: Period): ExposureStats {
  const stats: ExposureStats = { impressions: 0, detail: 0, map: 0, reservation: 0, saved: 0 };
  for (const e of events) {
    if (e.storeId !== storeId || e.sponsored || !inPeriod(e.createdAt, p)) continue;
    if (e.type === "recommendation_shown") stats.impressions += 1;
    else if (e.type === "store_detail_clicked") stats.detail += 1;
    else if (e.type === "map_clicked") stats.map += 1;
    else if (e.type === "reservation_link_clicked") stats.reservation += 1;
    else if (e.type === "store_saved") stats.saved += 1;
  }
  return stats;
}

function dailyImpressions(events: readonly InteractionEvent[], storeId: string, now: Date, days = 30) {
  const series: { date: string; value: number }[] = [];
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.storeId === storeId && !e.sponsored && e.type === "recommendation_shown") {
      const d = e.createdAt.slice(0, 10);
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    series.push({ date: d, value: counts.get(d) ?? 0 });
  }
  return series;
}

function reviewStats(reviews: readonly Review[], now: Date) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();
  const last30 = now.getTime() - 30 * 86_400_000;
  const recent = reviews.filter((r) => new Date(r.createdAt).getTime() >= last30);
  return {
    total: reviews.length,
    average: reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : null,
    newThisMonth: reviews.filter((r) => new Date(r.createdAt).getTime() >= monthStart).length,
    unreplied: reviews.filter((r) => !r.reply).length,
    aiDrafts: reviews.filter((r) => r.draft?.status === "ai_draft").length,
    distribution: [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((r) => r.rating === star).length })),
    lowRatingShare30d: recent.length >= 5 ? recent.filter((r) => r.rating <= 2).length / recent.length : null,
    latest: reviews.slice(0, 5),
  };
}

function areaDetailRate(db: Db, areaId: AreaId, p: Period): number | null {
  const ids = new Set(db.stores.filter((s) => s.areaId === areaId).map((s) => s.id));
  let shown = 0;
  let detail = 0;
  for (const e of db.events) {
    if (!e.storeId || !ids.has(e.storeId) || e.sponsored || !inPeriod(e.createdAt, p)) continue;
    if (e.type === "recommendation_shown") shown += 1;
    if (e.type === "store_detail_clicked") detail += 1;
  }
  return shown >= 50 ? Math.round((detail / shown) * 1000) / 10 : null;
}

const rate = (num: number, den: number) => (den >= 20 ? Math.round((num / den) * 1000) / 10 : null);

export function getStoreDashboard(actor: Actor, storeId: string, db: Db = getDb(), now: Date = new Date()) {
  assertStoreAccess(actor, storeId);
  const store = storeOrThrow(db, storeId);
  const { current, previous } = comparablePeriods(now);
  const reviews = reviewStats(db.reviews.filter((r) => r.storeId === storeId), now);
  const exposureNow = exposure(db.events, storeId, current);
  const exposurePrev = exposure(db.events, storeId, previous);

  const areaLogsNow = filterLogs(db.searchLogs, current, [store.areaId]);
  const areaLogsPrev = filterLogs(db.searchLogs, previous, [store.areaId]);
  const demandNow = summarizeDemand(areaLogsNow);
  const demandPrev = summarizeDemand(areaLogsPrev);
  const featureTrend = compareBreakdowns(demandNow.byFeature, demandPrev.byFeature);
  const sceneTrend = compareBreakdowns(demandNow.byScene, demandPrev.byScene);

  const actions = buildActionSuggestions({
    store,
    featureTrend,
    sceneTrend,
    unrepliedReviews: reviews.unreplied,
    lowRatingShare30d: reviews.lowRatingShare30d,
    detailRate: rate(exposureNow.detail, exposureNow.impressions),
    areaDetailRate: areaDetailRate(db, store.areaId, current),
  });

  return {
    store,
    period: current,
    reviews,
    exposure: { current: exposureNow, previous: exposurePrev },
    dailyImpressions: dailyImpressions(db.events, storeId, now),
    areaDemand: { areaLabel: areaLabel(store.areaId), summary: demandNow, topGenres: demandNow.byGenre.cells.slice(0, 5) },
    actions,
    synthetic: areaLogsNow.some((l) => l.synthetic),
  };
}

export function getStoreDemand(actor: Actor, storeId: string, scope: "area" | "all", db: Db = getDb(), now: Date = new Date()) {
  assertStoreAccess(actor, storeId);
  const store = storeOrThrow(db, storeId);
  const { current, previous } = comparablePeriods(now);
  const areaFilter = scope === "area" ? [store.areaId] : undefined;
  const logsNow = filterLogs(db.searchLogs, current, areaFilter);
  const logsPrev = filterLogs(db.searchLogs, previous, areaFilter);
  const now_ = summarizeDemand(logsNow);
  const prev = summarizeDemand(logsPrev);
  const exposureNow = exposure(db.events, storeId, current);

  return {
    store,
    scope,
    scopeLabel: scope === "area" ? `${areaLabel(store.areaId)}エリア` : "北海道全体（サンプル対象エリア）",
    period: current,
    previousPeriod: previous,
    current: now_,
    comparisons: {
      area: compareBreakdowns(now_.byArea, prev.byArea),
      genre: compareBreakdowns(now_.byGenre, prev.byGenre),
      budget: compareBreakdowns(now_.byBudget, prev.byBudget),
      scene: compareBreakdowns(now_.byScene, prev.byScene),
      feature: compareBreakdowns(now_.byFeature, prev.byFeature),
    },
    underserved: findUnderservedThemes(logsNow),
    ownExposure: {
      ...exposureNow,
      detailRate: rate(exposureNow.detail, exposureNow.impressions),
    },
    minCell: MIN_CELL_SESSIONS,
  };
}

function topConditions(logs: readonly SearchLog[], limit = 10) {
  const counts = new Map<string, number>();
  const add = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const l of logs) {
    l.conditions.areaIds.forEach((a) => add(`エリア：${areaLabel(a)}`));
    l.conditions.genreIds.forEach((g) => add(`ジャンル：${genreLabel(g)}`));
    l.conditions.scenes.forEach((s) => add(`シーン：${sceneLabel(s)}`));
    l.conditions.features.forEach((f) => add(`条件：${featureLabel(f)}`));
    l.conditions.keywords.forEach((k) => add(`キーワード：${k}`));
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, count]) => ({ label, count }));
}

function zeroResultThemes(logs: readonly SearchLog[], limit = 8) {
  const counts = new Map<string, number>();
  for (const l of logs) {
    if (l.resultCount > 0) continue;
    const c = l.conditions;
    const label =
      [
        ...c.areaIds.map(areaLabel),
        ...c.genreIds.map(genreLabel),
        ...c.features.map(featureLabel),
        c.budget ? `予算${(c.budget.max ?? c.budget.target ?? c.budget.min ?? 0).toLocaleString("ja-JP")}円` : "",
        c.mealTime === "lunch" ? "ランチ" : "",
      ]
        .filter(Boolean)
        .join(" × ") || "（条件なし）";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, count]) => ({ label, count }));
}

/** 運営ダッシュボード。運営者以外は呼べない */
export function getAdminOverview(actor: Actor, db: Db = getDb(), now: Date = new Date()) {
  assertOperator(actor);
  const { current } = comparablePeriods(now);
  const logs = filterLogs(db.searchLogs, current);
  const events = db.events.filter((e) => inPeriod(e.createdAt, current));
  const spent = spentByCampaign(db);
  const daily = new Map<string, number>();
  for (const l of db.searchLogs) {
    const d = l.createdAt.slice(0, 10);
    daily.set(d, (daily.get(d) ?? 0) + 1);
  }
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getTime() - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    return { date: d, value: daily.get(d) ?? 0 };
  });

  return {
    period: current,
    users: new Set(logs.map((l) => l.sessionId)).size,
    searches: logs.length,
    zeroResultRate: logs.length ? Math.round((logs.filter((l) => l.resultCount === 0).length / logs.length) * 1000) / 10 : null,
    recommendationImpressions: events.filter((e) => e.type === "recommendation_shown" && !e.sponsored).length,
    detailClicks: events.filter((e) => e.type === "store_detail_clicked").length,
    channelSplit: { line: logs.filter((l) => l.channel === "line").length, web: logs.filter((l) => l.channel === "web").length },
    popular: topConditions(logs),
    zeroResults: zeroResultThemes(logs),
    areaDemand: summarizeDemand(logs).byArea.cells,
    searchSeries: series,
    ads: {
      impressions: db.impressions.filter((i) => inPeriod(i.createdAt, current)).length,
      validClicks: db.clicks.filter((c) => c.valid && inPeriod(c.createdAt, current)).length,
      invalidClicks: db.clicks.filter((c) => !c.valid && inPeriod(c.createdAt, current)).length,
      billedYen: [...spent.values()].reduce((s, v) => s + v, 0),
      pendingReview: db.campaigns.filter((c) => c.status === "pending_review").length,
    },
    contracts: db.organizations.map((o) => ({ ...o, stores: db.stores.filter((s) => s.organizationId === o.id).map((s) => ({ id: s.id, name: s.name })) })),
    recentAudit: db.auditLogs.slice(0, 10),
    synthetic: logs.some((l) => l.synthetic),
  };
}

export function listStoresForAdmin(actor: Actor, db: Db = getDb()) {
  assertOperator(actor);
  // 重複候補：同じエリアで店名の主要部分が一致するもの
  const keyOf = (s: Store) => `${s.areaId}:${s.name.replace(/（架空）|\s|店|\d+号/g, "")}`;
  const groups = new Map<string, string[]>();
  for (const s of db.stores) groups.set(keyOf(s), [...(groups.get(keyOf(s)) ?? []), s.id]);
  return db.stores.map((s) => ({
    store: s,
    duplicateOf: (groups.get(keyOf(s)) ?? []).filter((id) => id !== s.id),
  }));
}

/** 店舗メンバーが見られる店舗の一覧（店舗切り替え用） */
export function listAccessibleStores(actor: Actor, db: Db = getDb()): Store[] {
  if (actor.kind === "operator") return db.stores.filter((s) => s.organizationId);
  if (actor.kind === "store_member") return db.stores.filter((s) => actor.storeIds.includes(s.id));
  return [];
}
