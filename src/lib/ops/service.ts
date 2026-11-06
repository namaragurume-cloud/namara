import "server-only";
import { opsTemplates } from "@/data/ops-templates";
import { addDays, fmtDate, fmtDateLong, fmtNum, fmtSlot, isLastDayOfMonth, jstDate } from "./dates";
import { db } from "./db";
import { sendToCreator, sendToRestaurant, type SendResult } from "./notify";
import type { Assignment, Campaign, Creator, Insight, Restaurant, Slot } from "./types";
import { assignmentUrl, creatorPortalUrl, restaurantPortalUrl } from "./urls";
import { newToken, nowIso } from "./util";

/* ------------------------------------------------------------------ */
/* 読み込み                                                            */
/* ------------------------------------------------------------------ */

export type Row = { a: Assignment; creator: Creator };

export type Bundle = {
  campaign: Campaign;
  restaurant: Restaurant | null;
  rows: Row[];
};

export async function loadBundle(campaignId: string): Promise<Bundle | null> {
  const campaign = await db.get("campaigns", campaignId);
  if (!campaign) return null;
  const [restaurant, assignments, creators] = await Promise.all([
    db.get("restaurants", campaign.restaurantId),
    db.list("assignments"),
    db.list("creators"),
  ]);
  const byId = new Map(creators.map((c) => [c.id, c]));
  const rows = assignments
    .filter((a) => a.campaignId === campaignId)
    .flatMap((a) => {
      const creator = byId.get(a.creatorId);
      return creator ? [{ a, creator }] : [];
    })
    .sort((x, y) => x.creator.name.localeCompare(y.creator.name, "ja"));
  return { campaign, restaurant, rows };
}

export async function findCampaignByShareToken(token: string): Promise<Campaign | null> {
  if (!token) return null;
  return (await db.list("campaigns")).find((c) => c.shareToken === token) ?? null;
}

export async function findCreatorByToken(token: string): Promise<Creator | null> {
  if (!token) return null;
  return (await db.list("creators")).find((c) => c.token === token && c.active) ?? null;
}

export const slotById = (c: Campaign, id?: string): Slot | undefined => c.slots.find((s) => s.id === id);
export const slotLabel = (c: Campaign, id?: string) => {
  const s = slotById(c, id);
  return s ? fmtSlot(s) : "未定";
};

/* ------------------------------------------------------------------ */
/* 進行状況                                                            */
/* ------------------------------------------------------------------ */

export type Phase = "draft" | "recruiting" | "confirming" | "scheduled" | "insight" | "report" | "done";

export const phaseLabel: Record<Phase, string> = {
  draft: "下書き",
  recruiting: "回答受付中",
  confirming: "日程確定待ち",
  scheduled: "撮影・投稿待ち",
  insight: "インサイト回収中",
  report: "レポート送付待ち",
  done: "完了",
};

export function phaseOf(b: Pick<Bundle, "campaign" | "rows">, today = jstDate()): Phase {
  const { campaign, rows } = b;
  if (campaign.reportSentAt) return "done";
  const sent = rows.filter((r) => r.a.status !== "unsent");
  if (sent.length === 0) return "draft";
  const accepted = rows.filter((r) => r.a.status === "accepted");
  const waiting = rows.filter((r) => r.a.status === "sent");
  const confirmed = accepted.filter((r) => r.a.confirmedNotifiedAt);
  if (confirmed.length === 0) return waiting.length > 0 && campaign.replyDeadline >= today ? "recruiting" : "confirming";
  if (accepted.some((r) => !r.a.confirmedNotifiedAt)) return "confirming";
  if (confirmed.every((r) => r.a.insight)) return "report";
  if (confirmed.some((r) => r.a.insightRequestedAt || r.a.insight)) return "insight";
  return "scheduled";
}

/* ------------------------------------------------------------------ */
/* 日程の自動割り当て                                                   */
/* ------------------------------------------------------------------ */

/**
 * 回答（参加できる枠）から撮影枠を割り当てる。
 * 確定済みはそのまま。選べる枠が少ない人から順に、空きの多い枠へ入れる。
 */
export function proposeSlots(campaign: Campaign, rows: Row[]): Map<string, string | undefined> {
  const result = new Map<string, string | undefined>();
  const used = new Map<string, number>();
  const accepted = rows.filter((r) => r.a.status === "accepted");
  for (const r of accepted) {
    if (r.a.confirmedSlotId) {
      result.set(r.a.id, r.a.confirmedSlotId);
      used.set(r.a.confirmedSlotId, (used.get(r.a.confirmedSlotId) ?? 0) + 1);
    }
  }
  const valid = new Set(campaign.slots.map((s) => s.id));
  const pending = accepted
    .filter((r) => !r.a.confirmedSlotId)
    .map((r) => ({ r, opts: r.a.availableSlotIds.filter((id) => valid.has(id)) }))
    .sort((x, y) => x.opts.length - y.opts.length || (x.r.a.respondedAt ?? "").localeCompare(y.r.a.respondedAt ?? ""));
  for (const { r, opts } of pending) {
    const free = opts
      .map((id) => ({ id, left: (slotById(campaign, id)?.capacity ?? 1) - (used.get(id) ?? 0) }))
      .filter((o) => o.left > 0)
      .sort((x, y) => y.left - x.left);
    const pick = free[0]?.id;
    result.set(r.a.id, pick);
    if (pick) used.set(pick, (used.get(pick) ?? 0) + 1);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* PR依頼の一括送信                                                    */
/* ------------------------------------------------------------------ */

export type BulkResult = { name: string; result: SendResult }[];

export function prRequestMsg(b: Bundle, creator: Creator, a: Assignment) {
  return opsTemplates.prRequest({
    creator: creator.name,
    restaurant: b.restaurant?.name ?? "",
    title: b.campaign.title,
    offer: b.campaign.offer,
    slots: b.campaign.slots.map(fmtSlot),
    replyDeadline: fmtDateLong(b.campaign.replyDeadline),
    url: assignmentUrl(creator, a),
  });
}

/** 選んだ発信者に依頼を作成し、まだ届いていない人にまとめて送信 */
export async function sendRequests(campaignId: string, creatorIds: string[]): Promise<BulkResult> {
  const before = await loadBundle(campaignId);
  if (!before) throw new Error("案件が見つかりません");
  const existing = new Set(before.rows.map((r) => r.creator.id));
  for (const id of creatorIds) {
    if (existing.has(id)) continue;
    const creator = await db.get("creators", id);
    if (!creator) continue;
    await db.put("assignments", {
      id: newToken(),
      campaignId,
      creatorId: id,
      status: "unsent",
      availableSlotIds: [],
      createdAt: nowIso(),
    });
  }
  const b = (await loadBundle(campaignId))!;
  const targets = b.rows.filter((r) => r.a.status === "unsent" && creatorIds.includes(r.creator.id));
  const out: BulkResult = [];
  for (const { a, creator } of targets) {
    const result = await sendToCreator(creator, prRequestMsg(b, creator, a), `PR依頼：${b.campaign.title}`);
    if (result.ok) {
      await db.update("assignments", a.id, (x) => ({ ...x, status: x.status === "unsent" ? "sent" : x.status, sentAt: nowIso(), sentVia: result.channel }));
    }
    out.push({ name: creator.name, result });
  }
  return out;
}

/** 手動で送った（コピーして自分のLINE/DMで送った）ことを記録 */
export async function markSentManually(assignmentId: string): Promise<void> {
  await db.update("assignments", assignmentId, (x) => ({
    ...x,
    status: x.status === "unsent" ? "sent" : x.status,
    sentAt: x.sentAt ?? nowIso(),
    sentVia: x.sentVia ?? "manual",
  }));
}

/* ------------------------------------------------------------------ */
/* 発信者の回答                                                        */
/* ------------------------------------------------------------------ */

export async function recordResponse(
  a: Assignment,
  campaign: Campaign,
  input: { accept: boolean; slotIds: string[]; plannedPostDate?: string; note?: string },
): Promise<void> {
  const valid = new Set(campaign.slots.map((s) => s.id));
  await db.update("assignments", a.id, (x) => {
    // 確定・通知済みの後は日程を変えさせない（変更は担当者に連絡）
    const locked = Boolean(x.confirmedNotifiedAt);
    return {
      ...x,
      status: locked ? x.status : input.accept ? "accepted" : "declined",
      availableSlotIds: locked ? x.availableSlotIds : input.accept ? input.slotIds.filter((id) => valid.has(id)) : [],
      plannedPostDate: input.accept ? input.plannedPostDate || x.plannedPostDate : undefined,
      note: input.note,
      respondedAt: nowIso(),
      sentAt: x.sentAt ?? nowIso(),
    };
  });
}

export async function recordInsight(a: Assignment, postUrl: string, insight: Omit<Insight, "submittedAt">): Promise<void> {
  await db.update("assignments", a.id, (x) => ({ ...x, postUrl, insight: { ...insight, submittedAt: nowIso() } }));
}

/* ------------------------------------------------------------------ */
/* 日程確定 → 発信者へ通知 / 飲食店へ共有                                  */
/* ------------------------------------------------------------------ */

export function confirmedMsg(b: Bundle, creator: Creator, a: Assignment) {
  return opsTemplates.confirmed({
    creator: creator.name,
    restaurant: b.restaurant?.name ?? "",
    address: b.restaurant?.address,
    slot: slotLabel(b.campaign, a.confirmedSlotId),
    postDate: a.plannedPostDate ? fmtDateLong(a.plannedPostDate) : `${fmtDateLong(b.campaign.postDeadline)}まで`,
    conditions: b.campaign.conditions,
    url: assignmentUrl(creator, a),
  });
}

export async function confirmSchedule(
  campaignId: string,
  picks: Record<string, { slotId?: string; postDate?: string }>,
): Promise<BulkResult> {
  const b = await loadBundle(campaignId);
  if (!b) throw new Error("案件が見つかりません");
  const out: BulkResult = [];
  for (const { a, creator } of b.rows) {
    if (a.status !== "accepted") continue;
    const pick = picks[a.id];
    if (!pick?.slotId || !slotById(b.campaign, pick.slotId)) continue;
    const changed = pick.slotId !== a.confirmedSlotId || (pick.postDate || a.plannedPostDate) !== a.plannedPostDate;
    const updated = (await db.update("assignments", a.id, (x) => ({
      ...x,
      confirmedSlotId: pick.slotId,
      plannedPostDate: pick.postDate || x.plannedPostDate,
    })))!;
    if (a.confirmedNotifiedAt && !changed) continue;
    const msg = confirmedMsg(b, creator, updated);
    const result = await sendToCreator(creator, msg, `撮影日確定：${b.campaign.title}`);
    if (result.ok) await db.update("assignments", a.id, (x) => ({ ...x, confirmedNotifiedAt: nowIso() }));
    out.push({ name: creator.name, result });
  }
  return out;
}

/** 手動で確定連絡をしたことにする */
export async function markConfirmedManually(assignmentId: string): Promise<void> {
  await db.update("assignments", assignmentId, (x) => ({ ...x, confirmedNotifiedAt: x.confirmedNotifiedAt ?? nowIso() }));
}

export function scheduleLines(b: Bundle): string[] {
  return b.rows
    .filter((r) => r.a.status === "accepted" && r.a.confirmedSlotId)
    .sort((x, y) => {
      const sx = slotById(b.campaign, x.a.confirmedSlotId);
      const sy = slotById(b.campaign, y.a.confirmedSlotId);
      return `${sx?.date}${sx?.start}`.localeCompare(`${sy?.date}${sy?.start}`);
    })
    .map(
      (r) =>
        `■ ${slotLabel(b.campaign, r.a.confirmedSlotId)}　${r.creator.name}（@${r.creator.account}）　投稿予定：${r.a.plannedPostDate ? fmtDate(r.a.plannedPostDate) : `${fmtDate(b.campaign.postDeadline)}まで`}`,
    );
}

export function restaurantScheduleMsg(b: Bundle) {
  return opsTemplates.restaurantSchedule({
    restaurant: b.restaurant?.name ?? "",
    contact: b.restaurant?.contactName,
    title: b.campaign.title,
    lines: scheduleLines(b),
    url: restaurantPortalUrl(b.campaign),
  });
}

export async function shareScheduleWithRestaurant(campaignId: string, manual = false): Promise<SendResult | null> {
  const b = await loadBundle(campaignId);
  if (!b || !b.restaurant) throw new Error("案件または店舗が見つかりません");
  const result = manual ? null : await sendToRestaurant(b.restaurant, restaurantScheduleMsg(b), `日程共有：${b.campaign.title}`);
  if (manual || result?.ok) await db.update("campaigns", campaignId, (c) => ({ ...c, scheduleSharedAt: nowIso() }));
  return result;
}

/* ------------------------------------------------------------------ */
/* レポート                                                            */
/* ------------------------------------------------------------------ */

export type ReportRow = {
  creator: Creator;
  slot?: Slot;
  postDate?: string;
  postUrl?: string;
  insight?: Insight;
  engagement?: number;
  rate?: number;
};

export type Report = {
  rows: ReportRow[];
  submitted: number;
  total: number;
  sum: { views: number; reach: number; likes: number; comments: number; saves: number; shares: number; profileVisits: number; follows: number; engagement: number };
  rate?: number;
  followers: number;
};

export function engagementOf(i: Insight): number {
  return i.likes + i.comments + i.saves + i.shares;
}

export function buildReport(b: Bundle): Report {
  const rows: ReportRow[] = b.rows
    .filter((r) => r.a.status === "accepted" && r.a.confirmedSlotId)
    .map(({ a, creator }) => {
      const insight = a.insight;
      const engagement = insight ? engagementOf(insight) : undefined;
      return {
        creator,
        slot: slotById(b.campaign, a.confirmedSlotId),
        postDate: a.plannedPostDate,
        postUrl: a.postUrl,
        insight,
        engagement,
        rate: insight && insight.reach > 0 ? engagement! / insight.reach : undefined,
      };
    })
    .sort((x, y) => (y.insight?.views ?? -1) - (x.insight?.views ?? -1));
  const sum = { views: 0, reach: 0, likes: 0, comments: 0, saves: 0, shares: 0, profileVisits: 0, follows: 0, engagement: 0 };
  for (const r of rows) {
    if (!r.insight) continue;
    sum.views += r.insight.views;
    sum.reach += r.insight.reach;
    sum.likes += r.insight.likes;
    sum.comments += r.insight.comments;
    sum.saves += r.insight.saves;
    sum.shares += r.insight.shares;
    sum.profileVisits += r.insight.profileVisits ?? 0;
    sum.follows += r.insight.follows ?? 0;
    sum.engagement += r.engagement ?? 0;
  }
  return {
    rows,
    submitted: rows.filter((r) => r.insight).length,
    total: rows.length,
    sum,
    rate: sum.reach > 0 ? sum.engagement / sum.reach : undefined,
    followers: rows.reduce((n, r) => n + (r.creator.followers ?? 0), 0),
  };
}

export const pct = (n?: number) => (n === undefined ? "-" : `${(n * 100).toFixed(1)}%`);

export function restaurantReportMsg(b: Bundle) {
  const r = buildReport(b);
  return opsTemplates.restaurantReport({
    restaurant: b.restaurant?.name ?? "",
    contact: b.restaurant?.contactName,
    title: b.campaign.title,
    summary: [
      `■ 投稿数：${r.submitted}件`,
      `■ 合計再生数：${fmtNum(r.sum.views)}回`,
      `■ 合計リーチ：${fmtNum(r.sum.reach)}人`,
      `■ いいね・コメント・保存・シェア：${fmtNum(r.sum.engagement)}件（エンゲージメント率 ${pct(r.rate)}）`,
    ],
    url: restaurantPortalUrl(b.campaign),
  });
}

export async function sendReportToRestaurant(campaignId: string, manual = false): Promise<SendResult | null> {
  const b = await loadBundle(campaignId);
  if (!b || !b.restaurant) throw new Error("案件または店舗が見つかりません");
  const result = manual ? null : await sendToRestaurant(b.restaurant, restaurantReportMsg(b), `レポート送付：${b.campaign.title}`);
  if (manual || result?.ok) await db.update("campaigns", campaignId, (c) => ({ ...c, reportSentAt: nowIso() }));
  return result;
}

/* ------------------------------------------------------------------ */
/* インサイト依頼・リマインド（毎日の自動処理）                            */
/* ------------------------------------------------------------------ */

type Ctx = { campaigns: Map<string, Campaign>; restaurants: Map<string, Restaurant>; creators: Map<string, Creator>; assignments: Assignment[] };

async function loadAll(): Promise<Ctx> {
  const [campaigns, restaurants, creators, assignments] = await Promise.all([
    db.list("campaigns"),
    db.list("restaurants"),
    db.list("creators"),
    db.list("assignments"),
  ]);
  return {
    campaigns: new Map(campaigns.map((c) => [c.id, c])),
    restaurants: new Map(restaurants.map((r) => [r.id, r])),
    creators: new Map(creators.map((c) => [c.id, c])),
    assignments,
  };
}

/** 投稿予定日（未入力なら撮影日）を過ぎていて、インサイト未提出・未依頼の投稿 */
function insightDue(ctx: Ctx, today: string, campaignId?: string) {
  return ctx.assignments.filter((a) => {
    if (campaignId && a.campaignId !== campaignId) return false;
    if (a.status !== "accepted" || !a.confirmedSlotId || a.insight || a.insightRequestedAt) return false;
    const c = ctx.campaigns.get(a.campaignId);
    const slot = c && slotById(c, a.confirmedSlotId);
    const due = a.plannedPostDate ?? slot?.date;
    return Boolean(c && !c.reportSentAt && due && due <= today);
  });
}

function groupByCreator(list: Assignment[]) {
  const m = new Map<string, Assignment[]>();
  for (const a of list) m.set(a.creatorId, [...(m.get(a.creatorId) ?? []), a]);
  return m;
}

export async function sendInsightRequests(opts: { today?: string; campaignId?: string } = {}): Promise<BulkResult> {
  const today = opts.today ?? jstDate();
  const ctx = await loadAll();
  const out: BulkResult = [];
  for (const [creatorId, list] of groupByCreator(insightDue(ctx, today, opts.campaignId))) {
    const creator = ctx.creators.get(creatorId);
    if (!creator) continue;
    const posts = list.map((a) => {
      const c = ctx.campaigns.get(a.campaignId)!;
      return `${ctx.restaurants.get(c.restaurantId)?.name ?? c.title}（撮影 ${slotLabel(c, a.confirmedSlotId)}）`;
    });
    const result = await sendToCreator(
      creator,
      opsTemplates.insightRequest({ creator: creator.name, posts, url: creatorPortalUrl(creator) }),
      "インサイト提出のお願い",
    );
    if (result.ok) {
      for (const a of list) await db.update("assignments", a.id, (x) => ({ ...x, insightRequestedAt: nowIso() }));
    }
    out.push({ name: creator.name, result });
  }
  return out;
}

const daysSince = (iso: string, today: string) =>
  Math.floor((Date.parse(`${today}T00:00:00+09:00`) - Date.parse(iso)) / 86_400_000);

export async function runReminders(today = jstDate()): Promise<BulkResult> {
  const ctx = await loadAll();
  const tomorrow = addDays(today, 1);
  const out: BulkResult = [];

  for (const a of ctx.assignments) {
    const c = ctx.campaigns.get(a.campaignId);
    const creator = ctx.creators.get(a.creatorId);
    if (!c || !creator || c.reportSentAt) continue;
    const restaurant = ctx.restaurants.get(c.restaurantId)?.name ?? c.title;

    // 回答期限の前日
    if (a.status === "sent" && !a.respondedAt && !a.replyRemindedAt && c.replyDeadline === tomorrow) {
      const result = await sendToCreator(
        creator,
        opsTemplates.replyReminder({ creator: creator.name, restaurant, replyDeadline: fmtDateLong(c.replyDeadline), url: assignmentUrl(creator, a) }),
        `回答リマインド：${c.title}`,
      );
      if (result.ok) await db.update("assignments", a.id, (x) => ({ ...x, replyRemindedAt: nowIso() }));
      out.push({ name: creator.name, result });
    }

    // 撮影の前日
    const slot = slotById(c, a.confirmedSlotId);
    if (a.status === "accepted" && a.confirmedNotifiedAt && !a.shootRemindedAt && slot?.date === tomorrow) {
      const result = await sendToCreator(
        creator,
        opsTemplates.shootReminder({ creator: creator.name, restaurant, slot: fmtSlot(slot), url: assignmentUrl(creator, a) }),
        `撮影前日リマインド：${c.title}`,
      );
      if (result.ok) await db.update("assignments", a.id, (x) => ({ ...x, shootRemindedAt: nowIso() }));
      out.push({ name: creator.name, result });
    }
  }

  // インサイト未提出（依頼から3日後に1回）
  const late = ctx.assignments.filter(
    (a) => a.insightRequestedAt && !a.insight && !a.insightRemindedAt && daysSince(a.insightRequestedAt, today) >= 3 && !ctx.campaigns.get(a.campaignId)?.reportSentAt,
  );
  for (const [creatorId, list] of groupByCreator(late)) {
    const creator = ctx.creators.get(creatorId);
    if (!creator) continue;
    const result = await sendToCreator(
      creator,
      opsTemplates.insightReminder({ creator: creator.name, count: list.length, url: creatorPortalUrl(creator) }),
      "インサイト提出リマインド",
    );
    if (result.ok) for (const a of list) await db.update("assignments", a.id, (x) => ({ ...x, insightRemindedAt: nowIso() }));
    out.push({ name: creator.name, result });
  }
  return out;
}

/**
 * インサイト依頼を送る日か。
 *   OPS_INSIGHT_DAY=last（既定）: 毎月末日 / 数字（例 25）: 毎月その日
 */
export function isInsightDay(today: string): boolean {
  const setting = (process.env.OPS_INSIGHT_DAY || "last").trim();
  if (setting === "last") return isLastDayOfMonth(today);
  const day = Number(setting);
  return Number.isInteger(day) && Number(today.slice(8, 10)) === day;
}

export async function runDaily(today = jstDate()) {
  const reminders = await runReminders(today);
  const insights = isInsightDay(today) ? await sendInsightRequests({ today }) : [];
  return { today, reminders, insights };
}
