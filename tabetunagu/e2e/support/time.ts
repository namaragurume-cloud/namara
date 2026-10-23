/**
 * E2E の出品フォームに入れる受取時間（JST の HH:MM）。実際の時刻に依存しないよう「いま」からの相対で作る。
 * - フォームの時刻は15分刻み（step=900）なので、受取開始は「いま」を15分単位で切り捨て（常に受取時間中）、
 *   受取終了は「いま + minutes」を15分単位で切り上げる（minutes 以上・minutes + 15分未満）
 * - 受取終了が日付をまたぐときは、アプリの仕様（終了が開始以前なら翌日）で翌日として扱われる
 * 固定の「00:00〜23:45」は深夜に過去の時間になるため使わない。
 */
const STEP_MS = 15 * 60_000;

export function pickupTimesFromNow(minutes: number) {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
  const now = Date.now();
  const start = Math.floor(now / STEP_MS) * STEP_MS;
  const end = Math.ceil((now + minutes * 60_000) / STEP_MS) * STEP_MS;
  return { start: fmt.format(new Date(start)), end: fmt.format(new Date(end)) };
}
