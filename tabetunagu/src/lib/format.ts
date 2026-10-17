import { TIME_ZONE } from "./constants";

const yenFmt = new Intl.NumberFormat("ja-JP");

export function yen(value: number) {
  return `${yenFmt.format(Math.round(value))}円`;
}

export function num(value: number) {
  return yenFmt.format(value);
}

export function percent(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

const timeFmt = new Intl.DateTimeFormat("ja-JP", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
const dateFmt = new Intl.DateTimeFormat("ja-JP", { timeZone: TIME_ZONE, month: "numeric", day: "numeric", weekday: "short" });
const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TIME_ZONE,
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const toDate = (d: Date | string) => (d instanceof Date ? d : new Date(d));

export function hhmm(d: Date | string) {
  return timeFmt.format(toDate(d));
}

/** JST の YYYY-MM-DD */
export function ymd(d: Date | string = new Date()) {
  return ymdFmt.format(toDate(d));
}

export function monthDay(d: Date | string) {
  return dateFmt.format(toDate(d));
}

export function dateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return dateTimeFmt.format(toDate(d));
}

/** 「本日 18:00〜20:00」「10/18(土) 18:00〜20:00」 */
export function pickupLabel(start: Date | string, end: Date | string, now = new Date()) {
  const s = toDate(start);
  const e = toDate(end);
  const today = ymd(now);
  const tomorrow = ymd(new Date(now.getTime() + 86_400_000));
  const day = ymd(s) === today ? "本日" : ymd(s) === tomorrow ? "明日" : monthDay(s);
  return `${day} ${hhmm(s)}〜${hhmm(e)}`;
}

export function grams(g: number) {
  if (g >= 1000) return `${(g / 1000).toFixed(g >= 10_000 ? 0 : 1)}kg`;
  return `${Math.round(g)}g`;
}
