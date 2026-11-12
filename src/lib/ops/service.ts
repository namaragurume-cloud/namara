import "server-only";
import { syncFollowersFromSite } from "./follower-sync";
import { addDays, fmtDate, fmtDateLong, fmtNum, fmtParty, fmtPostDates, fmtSlot, isLastDayOfMonth, jstDate } from "./dates";
import { db } from "./db";
import { sendToCreator, sendToRestaurant, type SendResult } from "./notify";
import { needsInsight } from "./insights";
import { msg } from "./templates";
import type { Msg } from "@/data/ops-templates";
import { candidatesText, findSlot, isFlex } from "./slots";
import { cleanupVideos } from "./video";
import { latestVideo, videoEnabled, videoStage } from "./video-state";
import { fieldLabel, isComplete, platformLabel, screenshotGuide } from "./insight-fields";
import { buildReport, pct, pct1 } from "./report";
import type { Assignment, Campaign, Creator, Platform, Restaurant, Slot } from "./types";
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

/** その人の報酬・特典（個別に決めたものがあればそれ、なければ案件の共通の報酬） */
export const offerOf = (a: Pick<Assignment, "offer">, c: Pick<Campaign, "offer">) => a.offer?.trim() || c.offer;

export const slotById = (c: Campaign, id?: string): Slot | undefined => findSlot(c, id);
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
  if (confirmed.every((r) => isComplete(r.a.insight))) return "report";
  if (confirmed.some((r) => r.a.insightRequestedAt || r.a.insight)) return "insight";
  return "scheduled";
}

/* ------------------------------------------------------------------ */
/* 日程の自動割り当て                                                   */
/* ------------------------------------------------------------------ */

/** 来店人数（本人＋同伴者） */
export const partyOf = (a: Pick<Assignment, "partySize">) => Math.max(1, a.partySize ?? 1);

/**
 * 回答（参加できる枠）から撮影枠を割り当てる。
 * 枠の人数は同伴者を含めた来店人数で数える（2名で来る人は2人分）。
 * 確定済みはそのまま。選べる枠が少ない人から順に、空きの多い枠へ入れる。
 */
export function proposeSlots(campaign: Campaign, rows: Row[]): Map<string, string | undefined> {
  const result = new Map<string, string | undefined>();
  const used = new Map<string, number>();
  const accepted = rows.filter((r) => r.a.status === "accepted");
  for (const r of accepted) {
    if (r.a.confirmedSlotId) {
      result.set(r.a.id, r.a.confirmedSlotId);
      used.set(r.a.confirmedSlotId, (used.get(r.a.confirmedSlotId) ?? 0) + partyOf(r.a));
    }
  }
  const flex = isFlex(campaign);
  const valid = { has: (id: string) => Boolean(findSlot(campaign, id)) };
  const pending = accepted
    .filter((r) => !r.a.confirmedSlotId)
    .map((r) => ({ r, opts: r.a.availableSlotIds.filter((id) => valid.has(id)) }))
    .sort((x, y) => x.opts.length - y.opts.length || (x.r.a.respondedAt ?? "").localeCompare(y.r.a.respondedAt ?? ""));
  for (const { r, opts } of pending) {
    const free = opts
      .map((id, order) => ({ id, order, left: (slotById(campaign, id)?.capacity ?? 1) - (used.get(id) ?? 0) }))
      .filter((o) => o.left >= partyOf(r.a))
      // 期間と時間帯から選ぶ案件は希望の順番どおり、候補日の案件は空きの多い枠から
      .sort((x, y) => (flex ? x.order - y.order : y.left - x.left));
    const pick = free[0]?.id;
    result.set(r.a.id, pick);
    if (pick) used.set(pick, (used.get(pick) ?? 0) + partyOf(r.a));
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* PR依頼の一括送信                                                    */
/* ------------------------------------------------------------------ */

export type BulkResult = { name: string; result: SendResult }[];

export function prRequestMsg(b: Bundle, creator: Creator, a: Assignment) {
  return msg(a.reRequestedAt ? "prRequestAgain" : "prRequest", {
    ひとこと: a.reRequestNote,
    発信者名: creator.name,
    店舗名: b.restaurant?.name ?? "",
    案件名: b.campaign.title,
    食べログ: b.restaurant?.tabelogUrl,
    Instagram: b.restaurant?.instagramUrl,
    報酬: offerOf(a, b.campaign),
    撮影候補日: candidatesText(b.campaign, jstDate()),
    投稿日: fmtPostDates(b.campaign),
    回答期限: fmtDateLong(b.campaign.replyDeadline),
    URL: assignmentUrl(creator, a),
  });
}

/** 選んだ発信者に依頼を作成し、まだ届いていない人にまとめて送信 */
export async function sendRequests(
  campaignId: string,
  creatorIds: string[],
  offers: Record<string, string> = {},
  notes: Record<string, string> = {},
): Promise<BulkResult> {
  const before = await loadBundle(campaignId);
  if (!before) throw new Error("案件が見つかりません");
  const existing = new Map(before.rows.map((r) => [r.creator.id, r.a]));
  for (const id of creatorIds) {
    const prev = existing.get(id);
    if (prev) {
      if (prev.status === "declined") {
        // 見送りの人にもう一度依頼する：回答画面を開き直して「改めてのご相談」を送る
        await db.update("assignments", prev.id, (x) => ({
          ...x,
          status: "unsent",
          availableSlotIds: [],
          respondedAt: undefined,
          note: undefined,
          replyRemindedAt: undefined,
          reRequestedAt: nowIso(),
          reRequestNote: notes[id] || undefined,
          offer: offers[id] !== undefined ? offers[id] || undefined : x.offer,
        }));
      } else if (prev.status === "unsent" && offers[id] !== undefined) {
        // 送れなかった依頼を送り直すときに、個別の報酬を変えた場合
        await db.update("assignments", prev.id, (x) => ({ ...x, offer: offers[id] || undefined }));
      }
      continue;
    }
    const creator = await db.get("creators", id);
    if (!creator) continue;
    await db.put("assignments", {
      id: newToken(),
      campaignId,
      creatorId: id,
      status: "unsent",
      offer: offers[id] || undefined,
      availableSlotIds: [],
      createdAt: nowIso(),
    });
  }
  const b = (await loadBundle(campaignId))!;
  const targets = b.rows.filter((r) => r.a.status === "unsent" && creatorIds.includes(r.creator.id));
  const out: BulkResult = [];
  for (const { a, creator } of targets) {
    const again = Boolean(a.reRequestedAt);
    const result = await sendToCreator(creator, await prRequestMsg(b, creator, a), `${again ? "再依頼" : "PR依頼"}：${b.campaign.title}`);
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
  input: { accept: boolean; slotIds: string[]; plannedPostDate?: string; partySize?: number; note?: string },
): Promise<void> {
  const valid = { has: (id: string) => Boolean(findSlot(campaign, id)) };
  await db.update("assignments", a.id, (x) => {
    // 確定・通知済みの後は日程を変えさせない（変更は担当者に連絡）
    const locked = Boolean(x.confirmedNotifiedAt);
    return {
      ...x,
      status: locked ? x.status : input.accept ? "accepted" : "declined",
      availableSlotIds: locked ? x.availableSlotIds : input.accept ? input.slotIds.filter((id) => valid.has(id)) : [],
      plannedPostDate: input.accept ? input.plannedPostDate || x.plannedPostDate : undefined,
      partySize: input.accept ? (input.partySize ?? x.partySize) : undefined,
      rescheduleRequestedAt: undefined,
      note: input.note,
      respondedAt: nowIso(),
      sentAt: x.sentAt ?? nowIso(),
    };
  });
}


/* ------------------------------------------------------------------ */
/* 日程確定 → 発信者へ通知 / 飲食店へ共有                                  */
/* ------------------------------------------------------------------ */

/** あなたからのひとこと（前後に空行を入れて本文に差し込む） */
const noteVar = (a: Assignment) => (a.confirmNote?.trim() ? `\n${a.confirmNote.trim()}\n` : undefined);

/** 文面を編集して {ひとこと} を消していても、ひとことは必ず届ける（宛名の段落のあとに入れる） */
async function withNote(m: Promise<Msg>, a: Assignment): Promise<Msg> {
  const r = await m;
  const note = a.confirmNote?.trim();
  if (!note || r.text.includes(note)) return r;
  const i = r.text.indexOf("\n\n");
  return { ...r, text: i < 0 ? `${note}\n\n${r.text}` : `${r.text.slice(0, i)}\n\n${note}${r.text.slice(i)}` };
}

export function confirmedMsg(b: Bundle, creator: Creator, a: Assignment) {
  const m = msg("confirmed", {
    ひとこと: noteVar(a),
    発信者名: creator.name,
    店舗名: b.restaurant?.name ?? "",
    住所: b.restaurant?.address,
    食べログ: b.restaurant?.tabelogUrl,
    Instagram: b.restaurant?.instagramUrl,
    撮影日時: slotLabel(b.campaign, a.confirmedSlotId),
    投稿日: a.plannedPostDate ? fmtDateLong(a.plannedPostDate) : `${fmtPostDates(b.campaign)}のいずれか`,
    投稿条件: b.campaign.conditions,
    URL: assignmentUrl(creator, a),
  });
  return withNote(m, a);
}

export async function confirmSchedule(
  campaignId: string,
  picks: Record<string, { slotId?: string; postDate?: string; note?: string }>,
  /** 連絡する全員に添えるひとこと */
  commonNote?: string,
): Promise<BulkResult> {
  const b = await loadBundle(campaignId);
  if (!b) throw new Error("案件が見つかりません");
  const out: BulkResult = [];
  for (const { a, creator } of b.rows) {
    if (a.status !== "accepted") continue;
    const pick = picks[a.id];
    if (!pick?.slotId || !slotById(b.campaign, pick.slotId)) continue;
    const newPost = pick.postDate || a.plannedPostDate;
    // 前に連絡した日程（確定済みなら今の日程、再調整中なら再調整前の日程）
    const prevSlot = a.confirmedNotifiedAt ? a.confirmedSlotId : a.previousSlotId;
    const prevPost = a.confirmedNotifiedAt ? a.plannedPostDate : a.previousPostDate;
    const changedFromNotified = Boolean(prevSlot) && (pick.slotId !== prevSlot || newPost !== prevPost);
    if (a.confirmedNotifiedAt && !changedFromNotified) {
      continue; // 連絡済みで変更なし
    }
    const confirmNote = [commonNote, pick.note].map((s) => s?.trim()).filter(Boolean).join("\n") || undefined;
    const updated = (await db.update("assignments", a.id, (x) => ({ ...x, confirmedSlotId: pick.slotId, plannedPostDate: newPost, confirmNote })))!;
    const isChange = Boolean(prevSlot);
    const message = isChange
      ? await scheduleChangedMsg(b, creator, updated, prevSlot, prevPost)
      : await confirmedMsg(b, creator, updated);
    const result = await sendToCreator(creator, message, `${isChange ? "日程変更" : "撮影日確定"}：${b.campaign.title}`);
    await db.update("assignments", a.id, (x) =>
      result.ok
        ? { ...x, confirmedNotifiedAt: nowIso(), previousSlotId: undefined, previousPostDate: undefined, scheduleChangedAt: isChange ? nowIso() : x.scheduleChangedAt }
        : // 送れなかったら「連絡できず」にして、管理画面から手動で送れるようにする（変更前の日程は残す）
          { ...x, confirmedNotifiedAt: undefined, previousSlotId: prevSlot, previousPostDate: prevPost },
    );
    out.push({ name: creator.name, result });
  }
  return out;
}

export function scheduleChangedMsg(b: Bundle, creator: Creator, a: Assignment, prevSlotId?: string, prevPost?: string) {
  const postLabel = (d?: string) => (d ? fmtDateLong(d) : `${fmtPostDates(b.campaign)}のいずれか`);
  const m = msg("scheduleChanged", {
    ひとこと: noteVar(a),
    発信者名: creator.name,
    店舗名: b.restaurant?.name ?? "",
    撮影日時: slotLabel(b.campaign, a.confirmedSlotId),
    撮影日時の変更: prevSlotId && prevSlotId !== a.confirmedSlotId ? `（変更前：${slotLabel(b.campaign, prevSlotId)}）` : "（変更なし）",
    投稿日: postLabel(a.plannedPostDate),
    投稿日の変更: prevPost !== a.plannedPostDate ? `（変更前：${postLabel(prevPost)}）` : "（変更なし）",
    住所: b.restaurant?.address,
    URL: assignmentUrl(creator, a),
  });
  return withNote(m, a);
}

/** 手動送信用：その依頼に今送るべき連絡（初めての確定か、変更か） */
export function confirmOrChangeMsg(b: Bundle, creator: Creator, a: Assignment) {
  return a.previousSlotId ? scheduleChangedMsg(b, creator, a, a.previousSlotId, a.previousPostDate) : confirmedMsg(b, creator, a);
}

/**
 * 日程の再調整をお願いする：その人の回答画面をもう一度開き、撮影日時を選び直してもらう。
 * 今の日程は「変更前」として残し、選び直した後に確定すると「日程変更」の連絡が届く。
 */
export async function requestReschedule(assignmentId: string, reason?: string): Promise<SendResult> {
  const a = await db.get("assignments", assignmentId);
  if (!a || a.status !== "accepted") throw new Error("参加が決まっている依頼だけ再調整をお願いできます");
  const b = (await loadBundle(a.campaignId))!;
  const creator = b.rows.find((r) => r.a.id === a.id)!.creator;
  const prevSlot = a.confirmedSlotId ?? a.previousSlotId;
  const prevPost = a.confirmedNotifiedAt ? a.plannedPostDate : a.previousPostDate ?? a.plannedPostDate;
  const updated = (await db.update("assignments", a.id, (x) => ({
    ...x,
    status: "sent" as const,
    availableSlotIds: [],
    confirmedSlotId: undefined,
    confirmedNotifiedAt: undefined,
    previousSlotId: prevSlot,
    previousPostDate: prevPost,
    respondedAt: undefined,
    rescheduleRequestedAt: nowIso(),
    rescheduleReason: reason,
  })))!;
  const today = jstDate();
  return sendToCreator(
    creator,
    await msg("rescheduleRequest", {
      発信者名: creator.name,
      店舗名: b.restaurant?.name ?? "",
      理由: reason,
      変更前の撮影日時: prevSlot ? slotLabel(b.campaign, prevSlot) : undefined,
      回答期限: b.campaign.replyDeadline >= today ? fmtDateLong(b.campaign.replyDeadline) : "なるべくお早めに",
      URL: assignmentUrl(creator, updated),
      撮影候補日: candidatesText(b.campaign, today),
    }),
    `日程の再調整のお願い：${b.campaign.title}`,
  );
}

/** 手動で確定連絡をしたことにする */
export async function markConfirmedManually(assignmentId: string): Promise<void> {
  await db.update("assignments", assignmentId, (x) => ({
    ...x,
    confirmedNotifiedAt: x.confirmedNotifiedAt ?? nowIso(),
    scheduleChangedAt: x.previousSlotId ? nowIso() : x.scheduleChangedAt,
    previousSlotId: undefined,
    previousPostDate: undefined,
  }));
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
        `■ ${slotLabel(b.campaign, r.a.confirmedSlotId)}　${r.creator.name}（@${r.creator.account}）　来店：${fmtParty(r.a.partySize)}　投稿日：${r.a.plannedPostDate ? fmtDate(r.a.plannedPostDate) : "調整中"}`,
    );
}

const atena = (r: Restaurant | null) => (r?.contactName ? `${r.contactName}様` : "ご担当者様");

export function restaurantScheduleMsg(b: Bundle) {
  return msg("restaurantSchedule", {
    店舗名: b.restaurant?.name ?? "",
    宛名: atena(b.restaurant),
    案件名: b.campaign.title,
    日程一覧: scheduleLines(b).join("\n"),
    URL: restaurantPortalUrl(b.campaign),
  });
}

export async function shareScheduleWithRestaurant(campaignId: string, manual = false): Promise<SendResult | null> {
  const b = await loadBundle(campaignId);
  if (!b || !b.restaurant) throw new Error("案件または店舗が見つかりません");
  const result = manual ? null : await sendToRestaurant(b.restaurant, await restaurantScheduleMsg(b), `日程共有：${b.campaign.title}`);
  if (manual || result?.ok) await db.update("campaigns", campaignId, (c) => ({ ...c, scheduleSharedAt: nowIso() }));
  return result;
}

/* ------------------------------------------------------------------ */
/* レポート                                                            */
/* ------------------------------------------------------------------ */

export function restaurantReportMsg(b: Bundle) {
  const r = buildReport(b);
  return msg("restaurantReport", {
    店舗名: b.restaurant?.name ?? "",
    宛名: atena(b.restaurant),
    案件名: b.campaign.title,
    結果の要約: [
      `■ 投稿数：${r.submitted}件`,
      `■ 合計閲覧数・再生数：${fmtNum(r.views)}回`,
      ...(r.reactions ? [`■ いいね・コメント・保存・シェア：${fmtNum(r.reactions)}件（エンゲージメント率 ${pct(r.er)}）`] : []),
      ...(r.nonFollowerPct !== undefined ? [`■ フォロワー以外への到達：${pct1(r.nonFollowerPct)}`] : []),
    ].join("\n"),
    URL: restaurantPortalUrl(b.campaign),
  });
}

export async function sendReportToRestaurant(campaignId: string, manual = false): Promise<SendResult | null> {
  const b = await loadBundle(campaignId);
  if (!b || !b.restaurant) throw new Error("案件または店舗が見つかりません");
  const result = manual ? null : await sendToRestaurant(b.restaurant, await restaurantReportMsg(b), `レポート送付：${b.campaign.title}`);
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
    if (!needsInsight(a) || a.insightRequestedAt) return false;
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
    // 投稿ごとに専用のリンクを付ける（どの投稿のスクショか迷わないように）
    const posts = list.map((a) => {
      const c = ctx.campaigns.get(a.campaignId)!;
      const askDate = a.postDateByCreator && !a.plannedPostDate ? "\n※ リンク先で投稿した日も入力してください" : "";
      return `・${ctx.restaurants.get(c.restaurantId)?.name ?? c.title}（撮影 ${slotLabel(c, a.confirmedSlotId)}）\n${assignmentUrl(creator, a)}${askDate}`;
    });
    const result = await sendToCreator(
      creator,
      await msg("insightRequest", {
        発信者名: creator.name,
        投稿一覧: posts.join("\n\n"),
        撮り方: guideLines(list, creator).join("\n"),
        送り方:
          list.length === 1
            ? `上のリンクから送ってください（数字は自動で読み取ります）。${creator.lineUserId ? "このトークに画像を送っていただいてもOKです。" : ""}`
            : "投稿ごとに、それぞれのリンクからその投稿のスクショを送ってください（数字は自動で読み取ります）。",
        URL: creatorPortalUrl(creator),
      }),
      "インサイト提出のお願い",
    );
    if (result.ok) {
      for (const a of list) await db.update("assignments", a.id, (x) => ({ ...x, insightRequestedAt: nowIso() }));
    }
    out.push({ name: creator.name, result });
  }
  return out;
}

/** 依頼文に入れるスクショの撮り方（媒体が分からなければ両方） */
function guideLines(list: Assignment[], creator: Creator): string[] {
  const fromCreator: Platform | undefined = /tiktok/i.test(creator.platform) ? "tiktok" : /instagram/i.test(creator.platform) ? "instagram" : undefined;
  const ps = new Set<Platform>(list.map((a) => a.platform ?? fromCreator).filter((p): p is Platform => Boolean(p)));
  const use: Platform[] = ps.size ? [...ps] : ["instagram", "tiktok"];
  return use.flatMap((p) => [`【${platformLabel[p]}】`, ...screenshotGuide[p].map((g) => `・${g}`)]);
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
        await msg("replyReminder", { 発信者名: creator.name, 店舗名: restaurant, 回答期限: fmtDateLong(c.replyDeadline), URL: assignmentUrl(creator, a) }),
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
        await msg("shootReminder", { 発信者名: creator.name, 店舗名: restaurant, 撮影日時: fmtSlot(slot), URL: assignmentUrl(creator, a) }),
        `撮影前日リマインド：${c.title}`,
      );
      if (result.ok) await db.update("assignments", a.id, (x) => ({ ...x, shootRemindedAt: nowIso() }));
      out.push({ name: creator.name, result });
    }
  }

  // 動画チェックあり：撮影日の翌日以降、まだ動画がなければ提出をお願い（1回）
  for (const a of ctx.assignments) {
    const c = ctx.campaigns.get(a.campaignId);
    const creator = ctx.creators.get(a.creatorId);
    if (!c || !creator || c.reportSentAt || !videoEnabled(c)) continue;
    const slot = slotById(c, a.confirmedSlotId);
    if (a.status !== "accepted" || !a.confirmedNotifiedAt || !slot || slot.date >= today) continue;
    if (a.videos?.length || a.videoRequestedAt || a.postUrl || a.insight) continue;
    const result = await sendToCreator(
      creator,
      await msg("videoRequest", {
        発信者名: creator.name,
        店舗名: ctx.restaurants.get(c.restaurantId)?.name ?? c.title,
        URL: assignmentUrl(creator, a),
        投稿日: a.plannedPostDate ? fmtDate(a.plannedPostDate) : fmtPostDates(c),
      }),
      `動画提出のお願い：${c.title}`,
    );
    if (result.ok) await db.update("assignments", a.id, (x) => ({ ...x, videoRequestedAt: nowIso() }));
    out.push({ name: creator.name, result });
  }

  // お店の動画確認が2日止まっていたら、お店に1回リマインド（案件ごとにまとめて）
  const waitingShop = new Map<string, Assignment[]>();
  for (const a of ctx.assignments) {
    const c = ctx.campaigns.get(a.campaignId);
    if (!c || c.reportSentAt || videoStage(a, c) !== "shop_review" || a.videoShopRemindedAt) continue;
    const since = latestVideo(a)?.sentToShopAt;
    if (!since || daysSince(since, today) < 2) continue;
    waitingShop.set(c.id, [...(waitingShop.get(c.id) ?? []), a]);
  }
  for (const [campaignId, list] of waitingShop) {
    const c = ctx.campaigns.get(campaignId)!;
    const r = ctx.restaurants.get(c.restaurantId);
    if (!r) continue;
    const result = await sendToRestaurant(
      r,
      await msg("restaurantVideoReminder", {
        店舗名: r.name,
        宛名: r.contactName ? `${r.contactName}様` : "ご担当者様",
        件数: String(list.length),
        URL: `${restaurantPortalUrl(c)}#video`,
      }),
      `動画確認のリマインド：${c.title}`,
    );
    // 自動で送れなかった場合も、毎日記録が増えないよう1回で止める（ホームの「あなたがやること」に出ます）
    for (const a of list) await db.update("assignments", a.id, (x) => ({ ...x, videoShopRemindedAt: nowIso() }));
    out.push({ name: r.name, result });
  }

  // インサイト未提出・不足（依頼から3日後に1回）
  const late = ctx.assignments.filter(
    (a) => a.insightRequestedAt && needsInsight(a) && !a.noInsightRemind && !a.insightRemindedAt && daysSince(a.insightRequestedAt, today) >= 3 && !ctx.campaigns.get(a.campaignId)?.reportSentAt,
  );
  out.push(...(await sendInsightReminders(ctx, late)));
  return out;
}

/** インサイト未提出・不足の人へのリマインド（同じ人の複数の投稿は1通にまとめる） */
async function sendInsightReminders(ctx: Ctx, targets: Assignment[]): Promise<BulkResult> {
  const out: BulkResult = [];
  for (const [creatorId, list] of groupByCreator(targets)) {
    const creator = ctx.creators.get(creatorId);
    if (!creator) continue;
    const lines = list.map((a) => {
      const c = ctx.campaigns.get(a.campaignId)!;
      const name = ctx.restaurants.get(c.restaurantId)?.name ?? c.title;
      const state = a.insight ? `${a.insight.missing.map((k) => fieldLabel(a.insight!.platform, k)).join("、")}が足りません` : "未提出";
      const askDate = a.postDateByCreator && !a.plannedPostDate ? "（投稿した日の入力もお願いします）" : "";
      return `・${name}：${state}${askDate}\n${assignmentUrl(creator, a)}`;
    });
    const result = await sendToCreator(creator, await msg("insightReminder", { 発信者名: creator.name, 投稿一覧: lines.join("\n\n"), URL: creatorPortalUrl(creator) }), "インサイト提出リマインド");
    if (result.ok) for (const a of list) await db.update("assignments", a.id, (x) => ({ ...x, insightRemindedAt: nowIso() }));
    out.push({ name: creator.name, result });
  }
  return out;
}

/** 案件の中で、提出をお願い済みなのに未提出・不足の人（今すぐリマインドの対象） */
export function insightRemindTargets(assignments: Assignment[]): Assignment[] {
  return assignments.filter((a) => a.insightRequestedAt && needsInsight(a) && !a.noInsightRemind);
}

/** 今すぐリマインド（3日待たずに、何度でも送れる） */
export async function remindInsightsNow(campaignId: string): Promise<BulkResult> {
  const ctx = await loadAll();
  if (ctx.campaigns.get(campaignId)?.reportSentAt) return [];
  return sendInsightReminders(ctx, insightRemindTargets(ctx.assignments.filter((a) => a.campaignId === campaignId)));
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
  await cleanupVideos(today).catch((e) => console.error("[video] cleanup", e));
  const insights = isInsightDay(today) ? await sendInsightRequests({ today }) : [];
  const followers = await syncFollowersFromSite().catch((e) => {
    console.error("[followers] sync", e);
    return null;
  });
  return { today, reminders, insights, followers };
}
