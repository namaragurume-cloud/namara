import { TIME_ZONE } from "./constants";
import { ymd } from "./format";

/** JST の日付（YYYY-MM-DD）と時刻（HH:MM）から Date を作る */
export function jstDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00+09:00`);
}

/** 受取時間（当日の HH:MM〜HH:MM）を Date に変換する。終了が開始以前なら翌日扱い。 */
export function pickupWindow(date: string, start: string, end: string) {
  const s = jstDateTime(date, start);
  let e = jstDateTime(date, end);
  if (e <= s) e = new Date(e.getTime() + 86_400_000);
  return { start: s, end: e };
}

/** JST の「今日」の 00:00 */
export function startOfJstDay(d = new Date()) {
  return new Date(`${ymd(d)}T00:00:00+09:00`);
}

/** JST の月初（YYYY-MM-01）と翌月初 */
export function jstMonthRange(month?: string) {
  const base = month && /^\d{4}-\d{2}$/.test(month) ? month : ymd().slice(0, 7);
  const [y, m] = base.split("-").map(Number);
  const start = new Date(`${base}-01T00:00:00+09:00`);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const end = new Date(`${next}-01T00:00:00+09:00`);
  return { month: base, start, end };
}

export function jstHour(d: Date | string) {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "2-digit", hour12: false })
      .format(typeof d === "string" ? new Date(d) : d)
      .replace("24", "0"),
  );
}

/** 現在時刻を 15 分単位で切り上げた HH:MM（出品フォームの初期値） */
export function roundedTimeFromNow(minutesAhead = 0, now = new Date()) {
  const t = new Date(now.getTime() + minutesAhead * 60_000);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(t)
    .split(":")
    .map(Number);
  let total = parts[0] * 60 + parts[1];
  total = Math.min(23 * 60 + 45, Math.ceil(total / 15) * 15);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
