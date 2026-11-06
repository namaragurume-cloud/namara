/** 日付まわり（すべて日本時間で扱う）。サーバー・クライアント両方から使用 */

const TZ = "Asia/Tokyo";

/** 日本時間の YYYY-MM-DD */
export function jstDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(d);
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isLastDayOfMonth(ymd: string): boolean {
  return addDays(ymd, 1).slice(8, 10) === "01";
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

/** 2026-11-20 → 11/20(金) */
export function fmtDate(ymd?: string): string {
  if (!ymd) return "未定";
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEK[d.getUTCDay()]})`;
}

/** 2026-11-20 → 2026年11月20日(金) */
export function fmtDateLong(ymd?: string): string {
  if (!ymd) return "未定";
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日(${WEEK[d.getUTCDay()]})`;
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtSlot(s: { date: string; start: string; end: string }): string {
  return `${fmtDate(s.date)} ${s.start}${s.end ? `〜${s.end}` : ""}`;
}

/** 案件の投稿日の表示（11/20(金)・11/22(日)） */
export function fmtPostDates(c: { postDates?: string[]; postDeadline: string }): string {
  return c.postDates?.length ? c.postDates.map(fmtDate).join("・") : `${fmtDate(c.postDeadline)}まで`;
}

export function fmtNum(n?: number): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("ja-JP") : "-";
}
