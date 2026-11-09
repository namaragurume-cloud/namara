import { addDays, fmtDate } from "./dates";
import type { Assignment, Campaign, FlexSchedule, Slot } from "./types";

/**
 * 撮影日時の枠。
 *  - fixed：案件で決めた候補日（campaign.slots）
 *  - flex ：期間と時間帯から発信者が選んだ日時。ID「f:YYYY-MM-DD:HH:mm」から枠を作る（保存しなくても全員同じ枠になる）
 */

export const isFlex = (c: Pick<Campaign, "scheduling" | "flex">) => c.scheduling === "flex" && Boolean(c.flex);

export const flexSlotId = (date: string, time: string) => `f:${date}:${time}`;

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function flexSlot(f: FlexSchedule, id: string): Slot | undefined {
  const m = id.match(/^f:(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2})$/);
  if (!m) return undefined;
  return { id, date: m[1], start: m[2], end: toTime(toMin(m[2]) + f.durationMin), capacity: f.capacity };
}

/** IDから枠を探す（候補日、または期間と時間帯で選ばれた日時） */
export function findSlot(c: Campaign, id?: string): Slot | undefined {
  if (!id) return undefined;
  return c.slots.find((s) => s.id === id) ?? (c.flex ? flexSlot(c.flex, id) : undefined);
}

/** 選べる日（期間・曜日・除外日。today を渡すとそれ以降だけ） */
export function flexDates(f: FlexSchedule, today?: string): string[] {
  const out: string[] = [];
  for (let d = f.from; d <= f.to && out.length < 400; d = addDays(d, 1)) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (!f.weekdays.includes(dow) || f.exclude.includes(d)) continue;
    if (today && d < today) continue;
    out.push(d);
  }
  return out;
}

/** 選べる開始時刻 */
export function flexTimes(f: FlexSchedule): string[] {
  const out: string[] = [];
  for (let t = toMin(f.start); t + f.durationMin <= toMin(f.end); t += Math.max(15, f.stepMin)) out.push(toTime(t));
  return out;
}

export function isValidFlexPick(f: FlexSchedule, date: string, time: string): boolean {
  return flexDates(f).includes(date) && flexTimes(f).includes(time);
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

/** 「11/10(月)〜11/30(日)・月火水木金・11:00〜21:00（1回60分）」 */
export function describeFlex(f: FlexSchedule): string {
  const days = f.weekdays.length === 7 ? "毎日" : [...f.weekdays].sort().map((d) => WEEK[d]).join("");
  const ex = f.exclude.length ? `（${f.exclude.map(fmtDate).join("・")}を除く）` : "";
  return `${fmtDate(f.from)}〜${fmtDate(f.to)}・${days}${ex}・${f.start}〜${f.end}（1回${f.durationMin}分）`;
}

/** 画面に並べる枠（fixed：候補日／flex：だれかが希望・確定した日時） */
export function slotsForCampaign(c: Campaign, assignments: Pick<Assignment, "availableSlotIds" | "confirmedSlotId" | "previousSlotId">[]): Slot[] {
  if (!isFlex(c)) return c.slots;
  const ids = new Set<string>();
  for (const a of assignments) {
    for (const id of a.availableSlotIds) ids.add(id);
    if (a.confirmedSlotId) ids.add(a.confirmedSlotId);
    if (a.previousSlotId) ids.add(a.previousSlotId);
  }
  return [...ids]
    .map((id) => findSlot(c, id))
    .filter((s): s is Slot => Boolean(s))
    .sort((x, y) => `${x.date}${x.start}`.localeCompare(`${y.date}${y.start}`));
}

/** 依頼文に載せる「撮影候補日」 */
export function candidatesText(c: Campaign, today: string): string {
  if (isFlex(c)) return `・${describeFlex(c.flex!)}\n（この中から、ご希望の日時を第3希望まで選べます）`;
  return c.slots
    .filter((s) => s.date >= today)
    .map((s) => `・${fmtDate(s.date)} ${s.start}${s.end ? `〜${s.end}` : ""}`)
    .join("\n");
}
