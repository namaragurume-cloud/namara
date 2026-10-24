import { discountOf } from "./deals";
import { featuredCard, featuredFlexBubble, type FeaturedCard, type FeaturedProduct } from "./featured-message";

/**
 * LINE 日次注目商品通知（「今夜の食べつなぎ」）の商品選定とメッセージ。
 * - AI 推薦は使わない。公開中・在庫あり・受取終了前・当日受取の商品から、割引率が高い順 → 受取終了が近い順に最大3件
 * - 同じ店舗に偏らないよう、まず1店舗1件ずつ選び、足りなければ1店舗2件まで
 * - 同じ商品を何日も続けて送らないよう、直近に送った商品は除く（PoC の簡易ルール）
 */

export const DIGEST_MAX_PRODUCTS = 3;
export const DIGEST_MAX_PER_STORE = 2;
/** 受取終了までこれより短い商品は選ばない（通知を見てから間に合わないため） */
export const DIGEST_MIN_LEAD_MS = 30 * 60_000;
/** この日数以内に同じユーザーへ送った商品は送らない */
export const DIGEST_REPEAT_DAYS = 2;
/** 連続でこの回数失敗したユーザーには、通知を ON にし直すまで送らない（無限に再送しない） */
export const DIGEST_MAX_CONSECUTIVE_FAILURES = 3;
/** 1回の実行で送る上限（PoC の安全装置） */
export const DIGEST_MAX_TARGETS_PER_RUN = 200;
export const DIGEST_TITLE = "今夜の食べつなぎ";

export type DigestCandidate = FeaturedProduct & { storeId: string };

const JST_OFFSET_MS = 9 * 60 * 60_000;

/** JST の日付（YYYY-MM-DD） */
export function jstDate(now: Date) {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** JST の翌日 0:00（= 当日受取の境界） */
export function jstEndOfDay(now: Date) {
  const d = new Date(now.getTime() + JST_OFFSET_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - JST_OFFSET_MS);
}

/** 通知に載せてよい商品か（在庫・受取時間・価格） */
export function isDigestEligible(p: DigestCandidate, now: Date) {
  const start = new Date(p.pickupStartAt).getTime();
  const end = new Date(p.pickupEndAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
  if (!(p.remaining > 0)) return false;
  if (end < now.getTime() + DIGEST_MIN_LEAD_MS) return false;
  if (start >= jstEndOfDay(now).getTime()) return false;
  if (!(p.rescuePrice > 0) || !(p.originalPrice >= p.rescuePrice)) return false;
  return true;
}

/** 最大3件を選ぶ（割引率が高い順 → 受取終了が近い順。1店舗1件ずつ → 足りなければ1店舗2件まで） */
export function selectDigestProducts(candidates: DigestCandidate[], now: Date, exclude: Iterable<string> = []): DigestCandidate[] {
  const skip = new Set(exclude);
  const sorted = candidates
    .filter((p) => !skip.has(p.id) && isDigestEligible(p, now))
    .sort((a, b) => {
      const rate = (discountOf(b.originalPrice, b.rescuePrice)?.rate ?? 0) - (discountOf(a.originalPrice, a.rescuePrice)?.rate ?? 0);
      if (rate !== 0) return rate;
      const end = new Date(a.pickupEndAt).getTime() - new Date(b.pickupEndAt).getTime();
      return end !== 0 ? end : a.id.localeCompare(b.id);
    });
  const picked: DigestCandidate[] = [];
  const perStore = new Map<string, number>();
  for (const limit of [1, DIGEST_MAX_PER_STORE]) {
    for (const p of sorted) {
      if (picked.length >= DIGEST_MAX_PRODUCTS) break;
      if (picked.includes(p) || (perStore.get(p.storeId) ?? 0) >= limit) continue;
      picked.push(p);
      perStore.set(p.storeId, (perStore.get(p.storeId) ?? 0) + 1);
    }
  }
  return picked;
}

export function digestCards(products: DigestCandidate[], opts: { liffId: string; appUrl: string; now: Date }): FeaturedCard[] {
  return products.map((p) => featuredCard(p, { ...opts, title: DIGEST_TITLE }));
}

/** 最大3商品のカルーセル（Flex Message） */
export function digestFlexMessage(cards: FeaturedCard[]) {
  const names = cards.map((c) => `${c.storeName}「${c.productName}」`).join("・");
  return {
    type: "flex",
    altText: `${DIGEST_TITLE}：${names}`.slice(0, 400),
    contents: { type: "carousel", contents: cards.map((c) => featuredFlexBubble(c)) },
  };
}
