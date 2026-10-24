import { z } from "zod";
import { TIME_ZONE } from "./constants";
import { ymd } from "./format";
import { pickupWindow } from "./time";

/**
 * かんたん出品（過去の商品をもう一度出品する）。
 * - 引き継ぐ: 商品名・画像・販売価格・参考価格・説明・BOX・カテゴリー
 * - 毎回入力する: 数量・受取開始・受取終了（過去の在庫・日時はそのまま使わない）。価格は変更可（既定は前回）
 * - 新しい商品として作成する（過去の商品・注文は変更しない）
 */

export const QUICK_RECENT_LIMIT = 20;
export const QUICK_USUAL_LIMIT = 3;
/** 「いつもの商品」の判定に使う期間と、最低出品回数 */
export const QUICK_USUAL_DAYS = 30;
export const QUICK_USUAL_MIN_TIMES = 2;

export type RelistSourceRow = {
  id: string;
  name: string;
  imageUrl: string | null;
  rescuePrice: number;
  originalPrice: number;
  isBox: boolean;
  category: string;
  description: string;
  quantity: number;
  pickupStartAt: string;
  pickupEndAt: string;
  createdAt: string;
};

export type RelistSource = RelistSourceRow & { times: number };

const keyOf = (p: { name: string; isBox: boolean }) => `${p.name.trim().normalize("NFKC").toLowerCase()}|${p.isBox ? 1 : 0}`;

/**
 * 過去の商品を、同じ商品（商品名・BOX）ごとに1件にまとめる。各グループは最新の出品の内容を使う。
 * recent: 最新利用順。usual: 直近30日に2回以上出品した商品を回数順に最大3件（AI なし）
 */
export function groupRelistSources(rows: RelistSourceRow[], now: Date) {
  const since = now.getTime() - QUICK_USUAL_DAYS * 86_400_000;
  const sorted = [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const groups = new Map<string, RelistSource>();
  for (const r of sorted) {
    const key = keyOf(r);
    const recentHit = new Date(r.createdAt).getTime() >= since ? 1 : 0;
    const g = groups.get(key);
    if (g) g.times += recentHit;
    else groups.set(key, { ...r, times: recentHit });
  }
  const all = [...groups.values()];
  const recent = all.slice(0, QUICK_RECENT_LIMIT);
  const usual = all
    .filter((g) => g.times >= QUICK_USUAL_MIN_TIMES)
    .sort((a, b) => b.times - a.times || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, QUICK_USUAL_LIMIT);
  return { recent, usual };
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const optionalYen = z
  .union([z.literal(""), z.coerce.number().int().min(1, "価格は1円以上にしてください").max(100_000, "価格は100,000円以下にしてください")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const quickRelistSchema = z
  .object({
    sourceId: z.string().uuid(),
    quantity: z.coerce.number({ error: "数量を入力してください" }).int("数量は整数で入力してください").min(1, "数量は1以上にしてください").max(999, "数量は999以下にしてください"),
    pickupDate: z.string().regex(YMD, "受取日を選んでください"),
    pickupStart: z.string().regex(HHMM, "受取開始時刻を入力してください"),
    pickupEnd: z.string().regex(HHMM, "受取終了時刻を入力してください"),
    rescuePrice: optionalYen,
    originalPrice: optionalYen,
  })
  .refine((v) => v.pickupStart !== v.pickupEnd, { path: ["pickupEnd"], error: "受取終了は開始と違う時刻にしてください" });

export type QuickRelistInput = z.output<typeof quickRelistSchema>;

/** 価格（変更しなければ前回の価格）。販売価格は参考価格以下 */
export function resolvePrices(source: { rescuePrice: number; originalPrice: number }, input: { rescuePrice: number | null; originalPrice: number | null }) {
  const rescuePrice = input.rescuePrice ?? source.rescuePrice;
  const originalPrice = input.originalPrice ?? source.originalPrice;
  if (rescuePrice > originalPrice) return { ok: false as const, message: "販売価格は参考価格以下にしてください。" };
  return { ok: true as const, rescuePrice, originalPrice };
}

/** 受取時間の表示（終了が開始以前なら翌日。例: 「今日 23:00〜翌1:00」） */
export function quickPickupLabel(date: string, start: string, end: string, now: Date) {
  if (!YMD.test(date) || !HHMM.test(start) || !HHMM.test(end)) return "";
  const w = pickupWindow(date, start, end);
  const day = date === ymd(now) ? "今日" : date === ymd(new Date(now.getTime() + 86_400_000)) ? "明日" : date;
  const nextDay = ymd(w.end) !== ymd(w.start);
  return `${day} ${start}〜${nextDay ? "翌" : ""}${Number(end.slice(0, 2))}:${end.slice(3)}`;
}

/** 前回の受取時刻（HH:MM。「前回と同じ時間」ボタン用。日付は使わない） */
export function previousTimes(source: { pickupStartAt: string; pickupEndAt: string }) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  return { start: f.format(new Date(source.pickupStartAt)), end: f.format(new Date(source.pickupEndAt)) };
}
