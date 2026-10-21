import { TOPIC_LABELS, TOPICS } from "./constants";
import type { Review, Store, Topic } from "./types";

/** ISO文字列（+09:00）から JST の "YYYY-MM" を得る */
export function monthKey(iso: string) {
  const date = new Date(new Date(iso).getTime() + 9 * 3600000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function jstParts(iso: string) {
  const date = new Date(new Date(iso).getTime() + 9 * 3600000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function shiftMonth(key: string, diff: number) {
  const [y, m] = key.split("-").map(Number);
  const index = y * 12 + (m - 1) + diff;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string, withYear = false) {
  const [y, m] = key.split("-").map(Number);
  return withYear ? `${y}年${m}月` : `${m}月`;
}

export function recentMonthKeys(todayIso: string, count: number) {
  const current = monthKey(todayIso);
  return Array.from({ length: count }, (_, i) => shiftMonth(current, i - count + 1));
}

export function average(reviews: Pick<Review, "rating">[]) {
  if (reviews.length === 0) return null;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

/** 前期比（%）。前期が0なら null */
export function percentChange(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export interface MonthlyPoint {
  key: string;
  label: string;
  count: number;
  average: number | null;
}

export function monthlyTrend(reviews: Review[], todayIso: string, months = 12): MonthlyPoint[] {
  const keys = recentMonthKeys(todayIso, months);
  const byMonth = new Map<string, Review[]>(keys.map((k) => [k, []]));
  for (const review of reviews) byMonth.get(monthKey(review.createdAt))?.push(review);
  return keys.map((key) => {
    const list = byMonth.get(key) ?? [];
    const avg = average(list);
    return { key, label: monthLabel(key), count: list.length, average: avg === null ? null : Math.round(avg * 100) / 100 };
  });
}

export interface Kpis {
  total: number;
  average: number | null;
  averagePrevMonth: number | null;
  averageThisMonth: number | null;
  thisMonth: number;
  /** 前月の同じ日付までの件数（月途中でも公平に比較するため） */
  prevMonthSamePeriod: number;
  unreplied: number;
  pending: number;
  failed: number;
  replyRate: number | null;
}

export function computeKpis(reviews: Review[], todayIso: string): Kpis {
  const current = monthKey(todayIso);
  const previous = shiftMonth(current, -1);
  const today = jstParts(todayIso);
  const thisMonthList = reviews.filter((r) => monthKey(r.createdAt) === current);
  const prevMonthList = reviews.filter((r) => monthKey(r.createdAt) === previous);
  const prevSamePeriod = prevMonthList.filter((r) => jstParts(r.createdAt).day <= today.day);
  const replied = reviews.filter((r) => r.status === "published").length;
  return {
    total: reviews.length,
    average: average(reviews),
    averageThisMonth: average(thisMonthList),
    averagePrevMonth: average(prevMonthList),
    thisMonth: thisMonthList.length,
    prevMonthSamePeriod: prevSamePeriod.length,
    unreplied: reviews.filter((r) => r.status === "unreplied" || r.status === "draft").length,
    pending: reviews.filter((r) => r.status === "pending").length,
    failed: reviews.filter((r) => r.status === "failed").length,
    replyRate: reviews.length === 0 ? null : (replied / reviews.length) * 100,
  };
}

export function ratingDistribution(reviews: Review[]) {
  const total = reviews.length;
  return [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter((r) => r.rating === rating).length;
    return { rating, count, percent: total === 0 ? 0 : (count / total) * 100 };
  });
}

export interface TopicStat {
  topic: Topic;
  label: string;
  positive: number;
  negative: number;
  /** ポジティブ率（%）。言及なしなら null */
  positiveRate: number | null;
}

export function topicStats(reviews: Review[]): TopicStat[] {
  return TOPICS.map((topic) => {
    let positive = 0;
    let negative = 0;
    for (const review of reviews) {
      for (const t of review.topics) {
        if (t.topic !== topic) continue;
        if (t.sentiment === "positive") positive++;
        else negative++;
      }
    }
    const total = positive + negative;
    return { topic, label: TOPIC_LABELS[topic], positive, negative, positiveRate: total ? (positive / total) * 100 : null };
  });
}

export function topKeywords(reviews: Review[], sentiment: "positive" | "negative", limit = 5) {
  const counts = new Map<string, number>();
  for (const review of reviews) {
    for (const t of review.topics) {
      if (t.sentiment !== sentiment || !t.keyword) continue;
      counts.set(t.keyword, (counts.get(t.keyword) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword, count]) => ({ keyword, count }));
}

export interface Suggestion {
  id: string;
  severity: "high" | "medium" | "info";
  title: string;
  detail: string;
}

const IMPROVEMENT_HINTS: Record<Topic, string> = {
  food: "指摘の多いメニューの味付け・仕込みを見直し、提供前の確認項目に加えることを検討してください。",
  service: "接客に関する指摘が続いています。忙しい時間帯の声かけや、注文の復唱ルールを共有すると効果的です。",
  price: "価格への不満が見られます。価格自体よりも、量や内容がメニューで伝わっているかを確認してみてください。",
  atmosphere: "店内の音・混雑に関する指摘があります。席の案内方法やBGMの音量を見直す余地があります。",
  speed: "提供時間への不満が目立ちます。ピーク時の仕込み量やオーダーの流れを確認してみてください。",
  cleanliness: "清潔感に関する指摘があります。テーブル・トイレの清掃チェックの頻度を見直してください。",
};

/**
 * 直近90日の口コミからルールベースで改善提案を作る（Phase 1 のモック）。
 * Phase 6 で OpenAI による月次分析に置き換え、根拠となる口コミを必ず添える。
 */
export function buildSuggestions(reviews: Review[], todayIso: string): Suggestion[] {
  const since = new Date(todayIso).getTime() - 90 * 86400000;
  const recent = reviews.filter((r) => new Date(r.createdAt).getTime() >= since);
  const suggestions: Suggestion[] = [];
  if (recent.length === 0) return suggestions;

  const stats = topicStats(recent)
    .filter((s) => s.negative > 0)
    .sort((a, b) => b.negative - a.negative);

  for (const stat of stats.slice(0, 2)) {
    const share = Math.round((stat.negative / recent.length) * 100);
    suggestions.push({
      id: `topic-${stat.topic}`,
      severity: share >= 8 ? "high" : "medium",
      title: `「${stat.label}」への指摘が${stat.negative}件あります`,
      detail: `直近90日の口コミの${share}%で${stat.label}についての不満が見られました。${IMPROVEMENT_HINTS[stat.topic]}`,
    });
  }

  const unreplied = reviews.filter((r) => r.status === "unreplied" || r.status === "draft");
  const lowUnreplied = unreplied.filter((r) => r.rating <= 2);
  if (lowUnreplied.length > 0) {
    suggestions.push({
      id: "low-unreplied",
      severity: "high",
      title: `★2以下の未返信が${lowUnreplied.length}件あります`,
      detail: "低評価の口コミは、他のお客様も返信内容を見ています。早めに丁寧な返信をすることで、お店の印象を保てます。",
    });
  }

  const best = topicStats(recent)
    .filter((s) => s.positive >= 3)
    .sort((a, b) => b.positive - a.positive)[0];
  const keywords = topKeywords(recent, "positive", 2);
  if (best) {
    suggestions.push({
      id: "strength",
      severity: "info",
      title: `強みは「${best.label}」です`,
      detail:
        keywords.length > 0
          ? `「${keywords.map((k) => k.keyword).join("」「")}」が特に好評です。メニューやSNSでの訴求に活用できます。`
          : `${best.label}についての好意的な口コミが${best.positive}件ありました。`,
    });
  }
  return suggestions;
}

export function monthlyReport(reviews: Review[], key: string) {
  const current = reviews.filter((r) => monthKey(r.createdAt) === key);
  const previous = reviews.filter((r) => monthKey(r.createdAt) === shiftMonth(key, -1));
  const currentTopics = topicStats(current);
  const previousTopics = topicStats(previous);
  const quotes = (sentiment: "positive" | "negative") =>
    current
      .filter((r) => r.text && (sentiment === "positive" ? r.rating >= 4 : r.rating <= 3))
      .filter((r) => r.topics.some((t) => t.sentiment === sentiment))
      .sort((a, b) => (sentiment === "positive" ? b.rating - a.rating : a.rating - b.rating))
      .slice(0, 3);
  return {
    key,
    count: current.length,
    previousCount: previous.length,
    average: average(current),
    previousAverage: average(previous),
    distribution: ratingDistribution(current),
    topics: currentTopics.map((t, i) => ({
      ...t,
      previousNegative: previousTopics[i].negative,
      previousPositive: previousTopics[i].positive,
    })),
    positiveKeywords: topKeywords(current, "positive"),
    negativeKeywords: topKeywords(current, "negative"),
    positiveQuotes: quotes("positive"),
    negativeQuotes: quotes("negative"),
  };
}

export function storeComparison(stores: Store[], reviews: Review[], key: string) {
  return stores.map((store) => {
    const storeReviews = reviews.filter((r) => r.storeId === store.id);
    const current = storeReviews.filter((r) => monthKey(r.createdAt) === key);
    const previous = storeReviews.filter((r) => monthKey(r.createdAt) === shiftMonth(key, -1));
    const replied = storeReviews.filter((r) => r.status === "published").length;
    return {
      store,
      count: current.length,
      previousCount: previous.length,
      average: average(current),
      previousAverage: average(previous),
      overallAverage: average(storeReviews),
      replyRate: storeReviews.length ? (replied / storeReviews.length) * 100 : null,
      unreplied: storeReviews.filter((r) => r.status === "unreplied" || r.status === "draft").length,
    };
  });
}
