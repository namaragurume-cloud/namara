/**
 * デモ用の合成データ（検索ログ・行動イベント・口コミ）。
 *
 * ダッシュボードや需要分析を「データがある状態」で確認するためだけのもので、実測値ではありません。
 * 画面では必ず「デモ用合成データ」と表示します。本番では生成しません。
 */
import { AREAS, GENRES, budgetBandOf, type AreaId, type GenreId } from "@/lib/shared/dictionaries";
import type { Review, SearchLog, Store } from "@/lib/shared/types";
import { createRng } from "@/lib/shared/random";
import { parseSearchText } from "@/lib/search/parser";
import { rankStores } from "@/lib/search/ranking";

const AREA_DEMAND: Partial<Record<AreaId, number>> = {
  susukino: 30,
  "sapporo-station": 22,
  odori: 18,
  tanukikoji: 6,
  maruyama: 6,
  otaru: 6,
  hakodate: 6,
  kotoni: 2,
  "shin-sapporo": 2,
  asahikawa: 2,
};

const GENRE_DEMAND: Partial<Record<GenreId, number>> = {
  yakiniku: 14,
  kaisen: 12,
  sushi: 10,
  ramen: 10,
  "soup-curry": 8,
  jingisukan: 8,
  izakaya: 10,
  italian: 7,
  cafe: 6,
  sweets: 4,
  yakitori: 4,
  washoku: 3,
  french: 2,
  chinese: 2,
};

function weightedPick<K extends string>(rng: ReturnType<typeof createRng>, weights: Partial<Record<K, number>>): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  const last = entries[entries.length - 1];
  if (!last) throw new Error("weightedPick: empty");
  return last[0];
}

export type SyntheticEvent = {
  type: "recommendation_shown" | "store_detail_clicked" | "map_clicked" | "reservation_link_clicked" | "store_saved" | "no_result";
  sessionId: string;
  searchId: string;
  storeId: string | null;
  position: number | null;
  createdAt: string;
};

export function generateSyntheticSearches(stores: readonly Store[], now: Date, days = 60) {
  const rng = createRng(4242);
  const logs: SearchLog[] = [];
  const events: SyntheticEvent[] = [];
  const sessionPool = Array.from({ length: 700 }, (_, i) => `syn-${i.toString(36)}`);
  const currentMonth = now.getUTCMonth();

  for (let d = days; d >= 1; d -= 1) {
    const day = new Date(now.getTime() - d * 86_400_000);
    const isCurrentMonth = day.getUTCMonth() === currentMonth;
    const weekend = day.getUTCDay() === 5 || day.getUTCDay() === 6;
    const perDay = 35 + rng.int(0, 15) + (weekend ? 15 : 0) + (isCurrentMonth ? 8 : 0);

    for (let i = 0; i < perDay; i += 1) {
      const area = AREAS.find((a) => a.id === weightedPick(rng, AREA_DEMAND));
      const genre = GENRES.find((g) => g.id === weightedPick(rng, GENRE_DEMAND));
      const parts: string[] = [];
      if (area && rng.next() < 0.85) parts.push(rng.pick(area.synonyms));
      if (genre && rng.next() < 0.9) parts.push(rng.pick(genre.synonyms));
      const lunch = rng.next() < 0.25;
      if (lunch) parts.push("ランチ");
      if (rng.next() < 0.55) {
        const budget = lunch ? rng.pick([1000, 1200, 1500, 2000]) : rng.pick([3000, 4000, 5000, 6000, 8000, 10000]);
        parts.push(rng.next() < 0.5 ? `予算${budget}円` : `${budget}円以内`);
      }
      // 今月は忘年会シーズンを想定して「個室」「宴会」の検索を増やす（デモ用の傾向）
      if (rng.next() < (isCurrentMonth ? 0.22 : 0.1)) parts.push("個室");
      if (rng.next() < (isCurrentMonth ? 0.15 : 0.06)) parts.push("宴会");
      if (rng.next() < 0.1) parts.push("デート");
      if (rng.next() < 0.08) parts.push("子連れ");
      if (rng.next() < 0.05) parts.push("禁煙");

      const text = parts.join(" ");
      const parsed = parseSearchText(text);
      const ranked = rankStores(stores, parsed.conditions, day);
      const createdAt = new Date(day.getTime() + rng.int(9 * 3600, 23 * 3600) * 1000).toISOString();
      const sessionId = rng.pick(sessionPool);
      const searchId = `syn-search-${logs.length}`;
      const c = parsed.conditions;
      const budgetYen = c.budget?.max ?? c.budget?.target ?? c.budget?.min ?? null;

      logs.push({
        id: searchId,
        sessionId,
        channel: rng.next() < 0.7 ? "line" : "web",
        rawText: null,
        conditions: c,
        budgetBand: budgetYen !== null ? budgetBandOf(budgetYen) : null,
        resultCount: ranked.results.length,
        shownStoreIds: ranked.results.map((r) => r.store.id),
        createdAt,
        synthetic: true,
      });

      if (ranked.results.length === 0) {
        events.push({ type: "no_result", sessionId, searchId, storeId: null, position: null, createdAt });
        continue;
      }
      for (const r of ranked.results) {
        events.push({ type: "recommendation_shown", sessionId, searchId, storeId: r.store.id, position: r.rank, createdAt });
        const positionFactor = 1 / r.rank;
        if (rng.next() < 0.3 * positionFactor) {
          events.push({ type: "store_detail_clicked", sessionId, searchId, storeId: r.store.id, position: r.rank, createdAt });
          if (rng.next() < 0.35) events.push({ type: "map_clicked", sessionId, searchId, storeId: r.store.id, position: r.rank, createdAt });
          if (r.store.reservationUrl && rng.next() < 0.2)
            events.push({ type: "reservation_link_clicked", sessionId, searchId, storeId: r.store.id, position: r.rank, createdAt });
          if (rng.next() < 0.1) events.push({ type: "store_saved", sessionId, searchId, storeId: r.store.id, position: r.rank, createdAt });
        }
      }
    }
  }
  return { logs, events };
}

const REVIEW_TEXTS: Record<number, string[]> = {
  5: ["料理がとても美味しく、スタッフの方も親切でした。また来ます。", "記念日に利用しました。雰囲気が良く大満足です。", "素材の良さが伝わる料理でした。"],
  4: ["味は満足。週末は少し待ちました。", "コスパが良いと思います。席がやや狭いのが残念。", "美味しかったです。駐車場が分かりにくかった。"],
  3: ["普通でした。提供までに時間がかかりました。", "料理は良いが、価格がもう少し分かりやすいと助かります。"],
  2: ["予約していたのに席の案内まで待たされました。", "味が少し濃いと感じました。"],
  1: ["接客の対応が残念でした。"],
};

/** デモ用の口コミ（Google口コミ連携のモック）。投稿者名は架空のラベル */
export function generateSyntheticReviews(storeIds: readonly string[], now: Date): Review[] {
  const rng = createRng(777);
  const reviews: Review[] = [];
  for (const storeId of storeIds) {
    const count = rng.int(40, 90);
    for (let i = 0; i < count; i += 1) {
      const r = rng.next();
      const rating = (r < 0.45 ? 5 : r < 0.75 ? 4 : r < 0.88 ? 3 : r < 0.96 ? 2 : 1) as Review["rating"];
      const createdAt = new Date(now.getTime() - rng.int(1, 180) * 86_400_000).toISOString();
      const replied = rng.next() < 0.6;
      const hasDraft = !replied && rng.next() < 0.4;
      reviews.push({
        id: `review-${storeId}-${i}`,
        storeId,
        source: "google_mock",
        rating,
        text: rng.pick(REVIEW_TEXTS[rating] ?? REVIEW_TEXTS[3] ?? []),
        authorLabel: `デモ投稿者${i + 1}`,
        createdAt,
        reply: replied ? { text: "ご来店ありがとうございました。（デモ返信）", publishedAt: createdAt } : null,
        draft: hasDraft ? { text: "ご来店いただきありがとうございます。いただいたご意見を今後の改善に活かします。（AI返信案・モック）", status: "ai_draft" } : null,
      });
    }
  }
  return reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
