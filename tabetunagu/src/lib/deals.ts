import { hhmm } from "./format";
import type { ProductCard } from "./types";

/**
 * ホーム・商品カードの「買う理由」の表示ルール（お得・残り・受取終了までの時間）。
 * 表示用の計算はここに集約し、画面では計算しない。
 */

/** 受取終了までこの分数以内なら「あと○分」 */
export const SOON_LABEL_MINUTES = 60;
/** ホームの「まもなく受取終了」に入れる、受取終了までの分数 */
export const ENDING_SOON_MINUTES = 90;

export type Discount = { rate: number; amount: number };

/**
 * お得率・お得額。元価格（○円相当）が販売価格より高いときだけ返す。
 * 不正な値（元価格なし・0以下・販売価格以下・数値でない）は null（表示しない）。率は切り捨て（大きく見せない）。
 */
export function discountOf(original: number | null | undefined, price: number | null | undefined): Discount | null {
  if (typeof original !== "number" || typeof price !== "number") return null;
  if (!Number.isFinite(original) || !Number.isFinite(price)) return null;
  if (original <= 0 || price < 0 || price >= original) return null;
  const rate = Math.floor(((original - price) / original) * 100);
  if (rate < 1) return null;
  return { rate, amount: original - price };
}

export type RemainingLabel = { text: string; last: boolean };

/** 残り数量の表示。在庫1は「残り1つ」（強調用に last=true）。在庫0は null */
export function remainingLabel(remaining: number, isBox: boolean): RemainingLabel | null {
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  if (remaining === 1) return { text: "残り1つ", last: true };
  return { text: `残り${remaining}${isBox ? "BOX" : "点"}`, last: false };
}

export type Deadline = { label: string; soon: boolean; minutesLeft: number };

/**
 * 受取終了までの表示。60分以内は「あと○分」（soon）、それより先は「23:30まで」。終了済みは null。
 * 秒単位のカウントダウンはしない（サーバーで描画した時点の値）。
 */
export function pickupDeadline(pickupEndAt: string, now: Date): Deadline | null {
  const minutesLeft = Math.floor((Date.parse(pickupEndAt) - now.getTime()) / 60_000);
  if (!Number.isFinite(minutesLeft) || minutesLeft < 1) return null;
  if (minutesLeft <= SOON_LABEL_MINUTES) return { label: `あと${minutesLeft}分`, soon: true, minutesLeft };
  return { label: `${hhmm(pickupEndAt)}まで`, soon: false, minutesLeft };
}

/** いま購入できる（公開中・在庫あり・受取終了前） */
export function isPurchasable(p: ProductCard, now: Date) {
  return p.status === "published" && p.remaining > 0 && Date.parse(p.pickupEndAt) > now.getTime();
}

export type HomeSections = {
  /** いま購入できる商品（エリアで絞り込み済み） */
  available: ProductCard[];
  /** うち、受取開始済みでいますぐ受け取れる数 */
  readyNow: number;
  recommended: ProductCard[];
  endingSoon: ProductCard[];
  boxes: ProductCard[];
};

/**
 * ホームのセクション分け。商品の取得は1回だけ（listAvailableProducts のおすすめ順）で、ここでは並べ替えと分類だけ。
 * 同じ商品は1つのセクションにだけ出す（まもなく受取終了 → 今日のおすすめ → 食べつなぎBOX の順に取る）。
 */
export function homeSections(sortedByRecommended: ProductCard[], now: Date, area?: string): HomeSections {
  const available = sortedByRecommended.filter((p) => isPurchasable(p, now) && (!area || p.areaId === area));
  const t = now.getTime();
  const readyNow = available.filter((p) => Date.parse(p.pickupStartAt) <= t).length;

  const endingSoon = available
    .filter((p) => Date.parse(p.pickupEndAt) - t <= ENDING_SOON_MINUTES * 60_000)
    .sort((a, b) => Date.parse(a.pickupEndAt) - Date.parse(b.pickupEndAt))
    .slice(0, 5);
  const used = new Set(endingSoon.map((p) => p.id));
  const recommended = available.filter((p) => !used.has(p.id)).slice(0, 6);
  for (const p of recommended) used.add(p.id);
  const boxes = available.filter((p) => p.isBox && !used.has(p.id)).slice(0, 6);
  return { available, readyNow, recommended, endingSoon, boxes };
}
