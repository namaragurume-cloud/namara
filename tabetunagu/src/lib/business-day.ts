/**
 * 店舗の営業日（店舗モニター・店舗の注文一覧の「本日」）。
 * 深夜まで営業する店舗があるため、暦日ではなく JST 03:00 で切り替える。
 *   2026-10-24 00:30 JST → 2026-10-23 営業日
 *   2026-10-24 02:59 JST → 2026-10-23 営業日
 *   2026-10-24 03:00 JST → 2026-10-24 営業日
 * ユーザー向けの日付表示・会計・決済の日時には使わない（店舗側の表示範囲だけ）。
 * サーバーのタイムゾーンに依存しないよう、JST（+09:00）を明示して計算する。
 */

export const BUSINESS_DAY_CUTOFF_HOUR = 3;

const JST_OFFSET_MS = 9 * 60 * 60_000;
const DAY_MS = 86_400_000;

/** 営業日（YYYY-MM-DD） */
export function businessDate(now: Date, cutoffHour = BUSINESS_DAY_CUTOFF_HOUR): string {
  // JST の壁時計で切替時刻だけ戻した日付 = 営業日
  return new Date(now.getTime() + JST_OFFSET_MS - cutoffHour * 60 * 60_000).toISOString().slice(0, 10);
}

/** 営業日の範囲 [start, end)（JST 03:00 〜 翌日 03:00） */
export function businessDayRange(now: Date, cutoffHour = BUSINESS_DAY_CUTOFF_HOUR) {
  const date = businessDate(now, cutoffHour);
  const start = new Date(`${date}T${String(cutoffHour).padStart(2, "0")}:00:00+09:00`);
  return { date, start, end: new Date(start.getTime() + DAY_MS) };
}

/** 受取時間が営業日の範囲に重なるか（店舗モニター・店舗の注文一覧と同じ条件） */
export function overlapsBusinessDay(pickupStartAt: string, pickupEndAt: string, now: Date, cutoffHour = BUSINESS_DAY_CUTOFF_HOUR) {
  const { start, end } = businessDayRange(now, cutoffHour);
  return Date.parse(pickupStartAt) < end.getTime() && Date.parse(pickupEndAt) >= start.getTime();
}
