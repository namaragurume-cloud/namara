/**
 * 推薦エンジン（構造化データによる絞り込みと順位付け）。
 *
 * 1. 必須条件（エリア・ジャンル・希望条件・予算・ランチ有無）で候補を抽出
 * 2. 予算・ジャンル・エリア・利用シーンで加点
 * 3. 情報の確認日（新しさ）で加点・減点
 * 4. 上位5店舗を返し、順位の理由（reasons）を記録
 *
 * 広告費は通常検索の順位に一切影響しない（広告は ads/selector.ts で別枠）。
 */
import { areaLabel, featureLabel, genreLabel, sceneLabel } from "@/lib/shared/dictionaries";
import type { MealTime, PriceRange, RecommendedStore, ScoreReason, SearchConditions, Store } from "@/lib/shared/types";
import { hasAnyCondition } from "./parser";

export const MAX_RESULTS = 5;
const FRESH_DAYS = 90;
const STALE_DAYS = 180;
const TARGET_TOLERANCE = 1.2;

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

/** 検索条件に応じて使う価格帯（ランチ／夜） */
export function relevantPrice(store: Store, mealTime: MealTime | null): { range: PriceRange; label: string } | null {
  if (mealTime === "lunch") return store.budget.lunch ? { range: store.budget.lunch, label: "昼" } : null;
  if (store.budget.dinner) return { range: store.budget.dinner, label: "夜" };
  if (store.budget.lunch) return { range: store.budget.lunch, label: "昼" };
  return null;
}

export function formatBudget(store: Store, mealTime: MealTime | null): { text: string; basis: string } {
  const price = relevantPrice(store, mealTime);
  if (!price || !store.budget.basis) return { text: "不明", basis: "価格情報を確認できていません" };
  return {
    text: `${price.label} ${yen(price.range.min)}〜${yen(price.range.max)}（1人あたり目安）`,
    basis: store.budget.basis,
  };
}

function daysBetween(fromDate: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) / 86_400_000);
}

type BudgetFit = "fit" | "near" | "out" | "unknown";

function budgetFit(store: Store, c: SearchConditions): BudgetFit {
  if (!c.budget) return "fit";
  const price = relevantPrice(store, c.mealTime);
  if (!price || !store.budget.basis) return "unknown";
  const { min, max } = price.range;
  const b = c.budget;
  if (b.max !== null) {
    if (max <= b.max) return "fit";
    if (min <= b.max) return "near";
    return "out";
  }
  if (b.min !== null) return max >= b.min ? "fit" : "out";
  if (b.target !== null) {
    if (min <= b.target && max <= b.target * TARGET_TOLERANCE) return "fit";
    if (min <= b.target * TARGET_TOLERANCE && max >= b.target * 0.5) return "near";
    return "out";
  }
  return "fit";
}

/** 必須条件をすべて満たすか（満たさない店は絶対に表示しない） */
export function meetsHardConditions(store: Store, c: SearchConditions): boolean {
  if (!store.published || store.verification.status !== "verified") return false;
  if (c.areaIds.length > 0 && !c.areaIds.includes(store.areaId)) return false;
  if (c.areaIds.length === 0 && c.cities.length > 0 && !c.cities.includes(store.city)) return false;
  if (c.genreIds.length > 0 && !store.genreIds.some((g) => c.genreIds.includes(g))) return false;
  if (!c.features.every((f) => store.features.includes(f))) return false;
  if (c.mealTime === "lunch" && store.budget.lunch === null) return false;
  const fit = budgetFit(store, c);
  if (fit === "out" || fit === "unknown") return false;
  return true;
}

export function scoreStore(store: Store, c: SearchConditions, now: Date): { score: number; reasons: ScoreReason[]; warnings: string[] } {
  const reasons: ScoreReason[] = [];
  const warnings: string[] = [];

  const primaryGenre = store.genreIds[0];
  if (c.genreIds.length > 0) {
    const matched = store.genreIds.find((g) => c.genreIds.includes(g));
    if (matched && matched === primaryGenre) reasons.push({ code: "genre_exact", label: `ジャンル「${genreLabel(matched)}」が一致`, points: 30 });
    else if (matched) reasons.push({ code: "genre_related", label: `「${genreLabel(matched)}」も提供`, points: 20 });
  }

  if (c.areaIds.includes(store.areaId)) reasons.push({ code: "area_exact", label: `エリア「${areaLabel(store.areaId)}」`, points: 20 });
  else if (c.cities.includes(store.city)) reasons.push({ code: "city_match", label: `${store.city}内（${areaLabel(store.areaId)}）`, points: 10 });

  if (c.budget) {
    const fit = budgetFit(store, c);
    const limit = c.budget.max ?? c.budget.target ?? c.budget.min;
    const limitText = limit ? yen(limit) : "";
    if (fit === "fit") reasons.push({ code: "budget_fit", label: `予算${limitText}${c.budget.min !== null && c.budget.max === null ? "以上" : ""}に収まる目安`, points: 20 });
    else if (fit === "near") reasons.push({ code: "budget_near", label: `予算${limitText}で選べるメニューあり（上限を超える場合あり）`, points: 8 });
  }

  const scenes = c.scenes.filter((s) => s !== "lunch");
  const matchedScenes = scenes.filter((s) => store.scenes.includes(s));
  for (const s of matchedScenes.slice(0, 2)) reasons.push({ code: "scene_match", label: `${sceneLabel(s)}向き`, points: 10 });

  for (const f of c.features) {
    if (store.features.includes(f)) reasons.push({ code: "feature_match", label: featureLabel(f), points: 5 });
  }

  for (const k of c.keywords) {
    const hit = store.tags.find((tag) => tag.includes(k) || k.includes(tag)) ?? (store.name.includes(k) ? k : null);
    if (hit) reasons.push({ code: "keyword_match", label: `「${hit}」`, points: 8 });
  }

  const verifiedAt = store.verification.verifiedAt;
  if (verifiedAt) {
    const days = daysBetween(verifiedAt, now);
    if (days <= FRESH_DAYS) reasons.push({ code: "fresh_info", label: `${verifiedAt}に情報確認済み`, points: 5 });
    else if (days > STALE_DAYS) {
      reasons.push({ code: "stale_info", label: "情報確認から6か月以上経過", points: -10 });
      warnings.push(`掲載情報の確認日は${verifiedAt}です。最新情報は店舗にご確認ください。`);
    }
  }

  if (!store.hours) warnings.push("営業時間は不明です。");
  const score = reasons.reduce((sum, r) => sum + r.points, 0);
  return { score, reasons, warnings };
}

/** ハード条件が無い（シーン・キーワードだけの）検索では、どれか1つは一致していることを求める */
function matchesSoftWhenNoHard(reasons: ScoreReason[], c: SearchConditions): boolean {
  const hasHard =
    c.areaIds.length > 0 || c.cities.length > 0 || c.genreIds.length > 0 || c.features.length > 0 || c.budget !== null || c.mealTime === "lunch";
  if (hasHard) return true;
  return reasons.some((r) => r.code === "scene_match" || r.code === "keyword_match");
}

export type RankResult = { results: RecommendedStore[]; totalCandidates: number };

export function rankStores(stores: readonly Store[], c: SearchConditions, now: Date = new Date()): RankResult {
  if (!hasAnyCondition(c)) return { results: [], totalCandidates: 0 };

  const scored = stores
    .filter((store) => meetsHardConditions(store, c))
    .map((store) => ({ store, ...scoreStore(store, c, now) }))
    .filter((item) => matchesSoftWhenNoHard(item.reasons, c))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.store.verification.verifiedAt ?? "").localeCompare(a.store.verification.verifiedAt ?? "") ||
        a.store.id.localeCompare(b.store.id),
    );

  const results = scored.slice(0, MAX_RESULTS).map((item, index) => {
    const budget = formatBudget(item.store, c.mealTime);
    return {
      store: item.store,
      rank: index + 1,
      score: item.score,
      reasons: item.reasons,
      budgetText: budget.text,
      budgetBasis: budget.basis,
      warnings: item.warnings,
    } satisfies RecommendedStore;
  });

  return { results, totalCandidates: scored.length };
}

/**
 * 件数が少ないときの「言い換え提案」。
 * 条件を勝手に緩めた結果は表示せず、どの条件を外すと何件あるかだけを伝える。
 */
export function buildSuggestions(stores: readonly Store[], c: SearchConditions, currentCount: number, now: Date = new Date()): string[] {
  if (currentCount >= MAX_RESULTS || !hasAnyCondition(c)) return [];
  const suggestions: string[] = [];
  const tryRelax = (label: string, relaxed: SearchConditions) => {
    const count = rankStores(stores, relaxed, now).totalCandidates;
    if (count > currentCount) suggestions.push(`${label}と${count}件見つかります。`);
  };

  for (const f of c.features) {
    tryRelax(`「${featureLabel(f)}」の条件を外す`, { ...c, features: c.features.filter((x) => x !== f) });
  }
  if (c.budget) tryRelax("予算の条件を外す", { ...c, budget: null });
  if (c.areaIds.length > 0) {
    const city = stores.find((s) => s.areaId === c.areaIds[0])?.city;
    if (city) tryRelax(`エリアを${city}全体に広げる`, { ...c, areaIds: [], cities: [city] });
  }
  if (c.genreIds.length > 0) tryRelax("ジャンルを指定しない", { ...c, genreIds: [] });
  return suggestions.slice(0, 3);
}
