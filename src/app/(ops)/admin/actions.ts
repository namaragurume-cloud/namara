"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { checkPassword, endSession, requireAdmin, startSession } from "@/lib/ops/auth";
import { blobs, db, resetDemo } from "@/lib/ops/db";
import { iconKey } from "@/lib/ops/creator-profile";
import { isOnSite, syncFollowersFromSite } from "@/lib/ops/follower-sync";
import { isDemo } from "@/lib/ops/demo-flag";
import type { BulkResult } from "@/lib/ops/service";
import {
  requestReschedule,
  loadBundle,
  confirmSchedule,
  markConfirmedManually,
  markSentManually,
  runDaily,
  sendInsightRequests,
  sendReportToRestaurant,
  sendRequests,
  shareScheduleWithRestaurant,
} from "@/lib/ops/service";
import { fieldLabel, insightFields, missingKeys, missingLabels, parseDistText } from "@/lib/ops/insight-fields";
import { draftReportText } from "@/lib/ops/ai-report";
import { proposalShareMsg } from "@/lib/ops/proposal-msg";
import { deleteShot } from "@/lib/ops/insights";
import { deleteAllVideoFiles, markSentToShop, ownerDecide, shopDecide, VideoError } from "@/lib/ops/video";
import { buildReport } from "@/lib/ops/report";
import { isAiConfigured } from "@/lib/ops/vision";
import { sendToCreator, sendToRestaurant } from "@/lib/ops/notify";
import { msg as tmsg } from "@/lib/ops/templates";
import { templateDefs, TEMPLATE_KEYS, unknownPlaceholders, type TemplateKey } from "@/data/ops-templates";
import { assignmentUrl, creatorPortalUrl } from "@/lib/ops/urls";
import { findSlot, flexDates, flexSlotId, flexTimes, isFlex } from "@/lib/ops/slots";
import type { Assignment, Campaign, Creator, FlexSchedule, Insight, Platform, Restaurant, Slot } from "@/lib/ops/types";
import { newLinkCode, newToken, nowIso, shortId } from "@/lib/ops/util";
import { isRateLimited } from "@/lib/spam";
import { toInstagramUrl } from "@/lib/ops/dates";
import { headers } from "next/headers";

/* ---------- 共通 ---------- */

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optStr = (fd: FormData, k: string) => str(fd, k) || undefined;
const optNum = (fd: FormData, k: string) => {
  const v = str(fd, k).replace(/[,，\s]/g, "");
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
};
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function back(path: string, flash: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}flash=${encodeURIComponent(flash)}`);
}

function summarize(label: string, list: BulkResult): string {
  if (list.length === 0) return `${label}：対象者はいませんでした`;
  const ok = list.filter((x) => x.result.ok);
  const line = ok.filter((x) => x.result.channel === "line").length;
  const mail = ok.filter((x) => x.result.channel === "email").length;
  const ng = list.filter((x) => !x.result.ok);
  const lines = [`${label}：${ok.length}件 送信しました（LINE ${line}・メール ${mail}）`];
  if (isDemo() && ok.length) lines.push("※デモのため実際には送信していません（送信履歴に記録のみ）");
  if (ng.length) lines.push(`自動送信できなかった人：${ng.map((x) => x.name).join("、")}\n→ 表の「文面をコピー」から手動で送ってください`);
  return (ng.length && !ok.length ? "!" : "") + lines.join("\n");
}

/* ---------- ログイン ---------- */

export async function login(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`admin-login:${ip}`)) return { error: "試行回数が多すぎます。10分ほど待ってから再度お試しください。" };
  if (!checkPassword(str(fd, "password"))) return { error: "パスワードが違います" };
  await startSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

/* ---------- 発信者 ---------- */

export async function saveCreator(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const name = str(fd, "name");
  const account = str(fd, "account").replace(/^@/, "");
  if (!name) back(id ? `/admin/creators/${id}` : "/admin/creators", "!名前を入力してください");
  const email = optStr(fd, "email");
  if (email && !z.email().safeParse(email).success) back(id ? `/admin/creators/${id}` : "/admin/creators", "!メールアドレスの形式が正しくありません");
  const profileUrl = optStr(fd, "profileUrl");
  if (profileUrl && !/^https?:\/\/\S+$/.test(profileUrl)) back(id ? `/admin/creators/${id}` : "/admin/creators", "!SNSのURLは https:// から入力してください");
  const patch = {
    name,
    account,
    platform: str(fd, "platform") || "Instagram",
    followers: optNum(fd, "followers"),
    email,
    memo: optStr(fd, "memo"),
    price: optNum(fd, "price"),
    profileUrl,
  };
  if (id) {
    const iconAt = await saveIcon(id, fd);
    await db.update("creators", id, (c) => ({ ...c, ...patch, iconAt: iconAt === undefined ? c.iconAt : iconAt || undefined }));
    if (isOnSite(account)) await syncFollowersFromSite().catch(() => null);
    back(`/admin/creators/${id}`, "保存しました");
  }
  const newId = shortId();
  const creator: Creator = { id: newId, ...patch, iconAt: (await saveIcon(newId, fd)) || undefined, token: newToken(), lineLinkCode: newLinkCode(), active: true, createdAt: nowIso() };
  await db.put("creators", creator);
  if (isOnSite(account)) await syncFollowersFromSite().catch(() => null);
  back(`/admin/creators/${creator.id}`, "登録しました。下の「最初の案内文」を本人に送ってください");
}

/**
 * フォームのアイコン画像を保存する。
 * 戻り値：新しい日時（保存した）／""（外した）／undefined（変更なし）
 */
async function saveIcon(creatorId: string, fd: FormData): Promise<string | undefined> {
  if (str(fd, "removeIcon") === "1") {
    await blobs.del(iconKey(creatorId));
    return "";
  }
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(str(fd, "icon"));
  if (!m || m[1].length > 400_000) return undefined;
  await blobs.setForever(iconKey(creatorId), m[1]);
  return nowIso();
}

export async function syncFollowersAction() {
  await requireAdmin();
  const r = await syncFollowersFromSite().catch(() => null);
  if (!r) back("/admin/creators", "!ホームページのフォロワー数を取り込めませんでした。時間をおいてもう一度お試しください");
  back(
    "/admin/creators",
    r.matched === 0
      ? "!ホームページと同じアカウント名の発信者がいませんでした（アカウント名を @なしで登録してください）"
      : `ホームページと連動している${r.matched}人のフォロワー数を取り込みました（変わった人：${r.updated}人）`,
  );
}

/** 1行1人：名前, アカウント, フォロワー数, メール */
export async function importCreators(fd: FormData) {
  await requireAdmin();
  const existing = new Set((await db.list("creators")).map((c) => c.account.toLowerCase()));
  let added = 0;
  const skipped: string[] = [];
  for (const line of str(fd, "rows").split(/\r?\n/)) {
    const cols = line.split(/[,\t、，]/).map((s) => s.trim());
    const [name, rawAccount, followers, email] = cols;
    if (!name) continue;
    const account = (rawAccount ?? "").replace(/^@/, "");
    if (account && existing.has(account.toLowerCase())) {
      skipped.push(name);
      continue;
    }
    const n = Number((followers ?? "").replace(/[,\s]/g, ""));
    await db.put("creators", {
      id: shortId(),
      name,
      account,
      platform: "Instagram",
      followers: Number.isFinite(n) && n > 0 ? n : undefined,
      email: email && z.email().safeParse(email).success ? email : undefined,
      token: newToken(),
      lineLinkCode: newLinkCode(),
      active: true,
      createdAt: nowIso(),
    });
    existing.add(account.toLowerCase());
    added++;
  }
  back("/admin/creators", `${added}人を登録しました${skipped.length ? `\n登録済みのため飛ばした人：${skipped.join("、")}` : ""}`);
}

export async function setCreatorActive(id: string, active: boolean) {
  await requireAdmin();
  await db.update("creators", id, (c) => ({ ...c, active }));
  back(`/admin/creators/${id}`, active ? "依頼対象に戻しました" : "依頼対象から外しました（専用ページも無効になります）");
}

export async function unlinkLine(id: string) {
  await requireAdmin();
  await db.update("creators", id, (c) => ({ ...c, lineUserId: undefined, lineLinkCode: newLinkCode() }));
  back(`/admin/creators/${id}`, "LINE連携を解除しました（連携コードも新しくなりました）");
}

export async function resetCreatorToken(id: string) {
  await requireAdmin();
  await db.update("creators", id, (c) => ({ ...c, token: newToken() }));
  back(`/admin/creators/${id}`, "専用ページのURLを作り直しました。古いURLは使えなくなります");
}

/* ---------- 飲食店 ---------- */

export async function saveRestaurant(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const name = str(fd, "name");
  const path = id ? `/admin/restaurants/${id}` : "/admin/restaurants";
  if (!name) back(path, "!店舗名を入力してください");
  const email = optStr(fd, "email");
  if (email && !z.email().safeParse(email).success) back(path, "!メールアドレスの形式が正しくありません");
  const tabelog = optStr(fd, "tabelogUrl");
  if (tabelog && !z.url().safeParse(tabelog).success) back(path, "!食べログのURLの形式が正しくありません（https:// から貼ってください）");
  const patch = {
    name,
    contactName: optStr(fd, "contactName"),
    email,
    phone: optStr(fd, "phone"),
    address: optStr(fd, "address"),
    tabelogUrl: optStr(fd, "tabelogUrl"),
    instagramUrl: toInstagramUrl(optStr(fd, "instagramUrl")),
    memo: optStr(fd, "memo"),
  };
  if (id) {
    await db.update("restaurants", id, (r) => ({ ...r, ...patch }));
    back(path, "保存しました");
  }
  const r: Restaurant = { id: shortId(), ...patch, lineLinkCode: newLinkCode(), createdAt: nowIso() };
  await db.put("restaurants", r);
  const next = str(fd, "next");
  if (next === "campaign") redirect(`/admin/campaigns/new?restaurant=${r.id}`);
  back(`/admin/restaurants/${r.id}`, "登録しました");
}

/* ---------- 案件 ---------- */

function readSlots(fd: FormData, prev: Slot[] = []): Slot[] {
  const ids = fd.getAll("slotId").map(String);
  const dates = fd.getAll("slotDate").map(String);
  const starts = fd.getAll("slotStart").map(String);
  const ends = fd.getAll("slotEnd").map(String);
  const caps = fd.getAll("slotCapacity").map(String);
  const known = new Set(prev.map((s) => s.id));
  return dates
    .map((date, i) => ({
      id: ids[i] && known.has(ids[i]) ? ids[i] : shortId(),
      date,
      start: starts[i] || "",
      end: ends[i] || "",
      capacity: Math.max(1, Math.min(50, Number(caps[i]) || 1)),
    }))
    .filter((s) => ymd.safeParse(s.date).success)
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
}

export async function saveCampaign(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const path = id ? `/admin/campaigns/${id}/edit` : "/admin/campaigns/new";
  const restaurantId = str(fd, "restaurantId");
  const title = str(fd, "title");
  const replyDeadline = str(fd, "replyDeadline");
  const postDates = [...new Set(fd.getAll("postDates").map(String))].filter((d) => ymd.safeParse(d).success).sort();
  const postDeadline = postDates.at(-1) ?? "";
  if (!restaurantId || !(await db.get("restaurants", restaurantId))) back(path, "!店舗を選んでください");
  if (!title) back(path, "!案件名を入力してください");
  if (!ymd.safeParse(replyDeadline).success) back(path, "!回答期限を入力してください");
  if (postDates.length === 0) back(path, "!投稿日をカレンダーから1日以上選んでください");
  const prev = id ? await db.get("campaigns", id) : null;
  // 店舗のリンク（入力があれば店舗情報に保存。空欄なら登録済みのものをそのまま使う）
  const tabelogUrl = optStr(fd, "tabelogUrl");
  const instagramUrl = toInstagramUrl(optStr(fd, "instagramUrl"));
  if (tabelogUrl && !z.url().safeParse(tabelogUrl).success) back(path, "!食べログのURLの形式が正しくありません（https:// から貼ってください）");
  if (tabelogUrl || instagramUrl) {
    await db.update("restaurants", restaurantId, (r) => ({ ...r, tabelogUrl: tabelogUrl ?? r.tabelogUrl, instagramUrl: instagramUrl ?? r.instagramUrl }));
  }
  const scheduling: "fixed" | "flex" = str(fd, "scheduling") === "flex" ? "flex" : "fixed";
  const slots = readSlots(fd, prev?.slots);
  let flex: FlexSchedule | undefined;
  if (scheduling === "flex") {
    const num = (k: string, d: number, min: number, max: number) => Math.min(max, Math.max(min, Number(str(fd, k)) || d));
    flex = {
      from: str(fd, "flexFrom"),
      to: str(fd, "flexTo"),
      weekdays: fd.getAll("flexWeekdays").map(Number).filter((n) => n >= 0 && n <= 6),
      start: str(fd, "flexStart") || "11:00",
      end: str(fd, "flexEnd") || "21:00",
      durationMin: num("flexDuration", 60, 15, 600),
      stepMin: num("flexStep", 30, 15, 120),
      capacity: num("flexCapacity", 2, 1, 50),
      exclude: [...new Set(fd.getAll("flexExclude").map(String))].filter((d) => ymd.safeParse(d).success),
    };
    if (!ymd.safeParse(flex.from).success || !ymd.safeParse(flex.to).success || flex.from > flex.to) back(path, "!撮影できる期間（開始日・終了日）を入力してください");
    if (flex.weekdays.length === 0) back(path, "!撮影できる曜日を1つ以上選んでください");
    if (flexTimes(flex).length === 0) back(path, "!時間帯が短すぎます（1回の撮影の長さが入る時間帯にしてください）");
    if (flexDates(flex).length === 0) back(path, "!期間・曜日・撮影できない日の設定で、選べる日がありません");
  } else if (slots.length === 0) back(path, "!撮影候補日を1つ以上入力してください");
  const patch = {
    restaurantId,
    title,
    description: str(fd, "description"),
    offer: str(fd, "offer"),
    conditions: str(fd, "conditions"),
    slots,
    scheduling,
    flex: flex ?? prev?.flex,
    replyDeadline,
    postDates,
    postDeadline,
  };
  if (prev) {
    await db.put("campaigns", { ...prev, ...patch });
    back(`/admin/campaigns/${prev.id}`, "保存しました");
  }
  const proposalId = optStr(fd, "proposalId");
  const c: Campaign = { id: shortId(), ...patch, proposalId, shareToken: newToken(), liveShare: true, createdAt: nowIso() };
  if (proposalId) await db.update("proposals", proposalId, (p) => ({ ...p, campaignId: c.id }));
  await db.put("campaigns", c);
  back(`/admin/campaigns/${c.id}`, "案件を作成しました。次に依頼する発信者を選んで一括送信してください");
}

/** 依頼と、そのスクショ画像もまとめて削除 */
async function removeAssignments(list: Assignment[]) {
  for (const a of list) await deleteAllVideoFiles(a);
  const ids = new Set(list.map((a) => a.id));
  for (const s of (await db.list("shots")).filter((s) => ids.has(s.assignmentId))) await deleteShot(s);
  for (const a of list) await db.remove("assignments", a.id);
}

async function removeCampaign(id: string) {
  await removeAssignments((await db.list("assignments")).filter((a) => a.campaignId === id));
  await db.remove("campaigns", id);
}

export async function deleteCampaign(id: string) {
  await requireAdmin();
  await removeCampaign(id);
  back("/admin", "案件を削除しました");
}

/** 店舗を削除（その店舗の案件・依頼・スクショもすべて削除） */
export async function deleteRestaurant(id: string) {
  await requireAdmin();
  const r = await db.get("restaurants", id);
  if (!r) back("/admin/restaurants", "!店舗が見つかりません");
  const campaigns = (await db.list("campaigns")).filter((c) => c.restaurantId === id);
  for (const c of campaigns) await removeCampaign(c.id);
  await db.remove("restaurants", id);
  back("/admin/restaurants", `「${r.name}」を削除しました${campaigns.length ? `（案件${campaigns.length}件も削除）` : ""}`);
}

/** 発信者を削除（その人への依頼・スクショもすべて削除。レポートの数字からも消えます） */
export async function deleteCreator(id: string) {
  await requireAdmin();
  const c = await db.get("creators", id);
  if (!c) back("/admin/creators", "!発信者が見つかりません");
  const list = (await db.list("assignments")).filter((a) => a.creatorId === id);
  await removeAssignments(list);
  await blobs.del(iconKey(id)).catch(() => {});
  await db.remove("creators", id);
  back("/admin/creators", `「${c.name}」さんを削除しました${list.length ? `（依頼${list.length}件も削除）` : ""}`);
}

export async function sendRequestsAction(campaignId: string, fd: FormData) {
  await requireAdmin();
  const ids = fd.getAll("creatorId").map(String).filter(Boolean);
  if (ids.length === 0) back(`/admin/campaigns/${campaignId}`, "!依頼する発信者を選んでください");
  const offers = Object.fromEntries(ids.map((id) => [id, str(fd, `offer_${id}`)]).filter(([, v]) => v));
  const result = await sendRequests(campaignId, ids, offers);
  back(`/admin/campaigns/${campaignId}`, summarize("PR依頼", result));
}

/** 実施済みの案件に、発信者を「参加・撮影済み」として記録だけ追加する（連絡はしない） */
export async function addPastParticipants(campaignId: string, fd: FormData) {
  await requireAdmin();
  const c = await db.get("campaigns", campaignId);
  if (!c) back("/admin", "!案件が見つかりません");
  const ids = fd.getAll("creatorId").map(String).filter(Boolean);
  if (ids.length === 0) back(`/admin/campaigns/${campaignId}`, "!記録する発信者を選んでください");
  const pastDate = str(fd, "pastDate");
  const pastTime = str(fd, "pastTime");
  const slotId = isFlex(c)
    ? ymd.safeParse(pastDate).success && /^\d{2}:\d{2}$/.test(pastTime)
      ? flexSlotId(pastDate, pastTime)
      : undefined
    : (c.slots.find((s) => s.id === str(fd, "slotId"))?.id ?? c.slots[0]?.id);
  if (isFlex(c) && !slotId) back(`/admin/campaigns/${campaignId}`, "!撮影日と開始時刻を入力してください");
  const postDate = str(fd, "postDate");
  const existing = new Set((await db.list("assignments")).filter((a) => a.campaignId === campaignId).map((a) => a.creatorId));
  let added = 0;
  for (const id of ids) {
    if (existing.has(id) || !(await db.get("creators", id))) continue;
    const t = nowIso();
    await db.put("assignments", {
      id: newToken(),
      campaignId,
      creatorId: id,
      status: "accepted",
      sentAt: t,
      sentVia: "manual",
      availableSlotIds: slotId ? [slotId] : [],
      confirmedSlotId: slotId,
      plannedPostDate: ymd.safeParse(postDate).success ? postDate : undefined,
      postDateByCreator: ymd.safeParse(postDate).success ? undefined : true,
      respondedAt: t,
      confirmedNotifiedAt: t,
      createdAt: t,
    });
    added++;
  }
  back(`/admin/campaigns/${campaignId}`, `${added}人を実施済みとして記録しました（連絡はしていません）。下の「インサイトのスクショ回収」から各発信者のスクショを追加するか、提出のお願いを送ってください${ymd.safeParse(postDate).success ? "" : "。投稿日は、提出のときに各発信者に入力してもらいます"}`);
}

/** 見送りの人にもう一度依頼する */
export async function reRequestAction(campaignId: string, creatorId: string, fd: FormData) {
  await requireAdmin();
  const note = str(fd, "note");
  const result = await sendRequests(campaignId, [creatorId], {}, note ? { [creatorId]: note } : {});
  back(`/admin/campaigns/${campaignId}`, summarize("再依頼", result));
}

export async function markSentAction(campaignId: string, assignmentId: string) {
  await requireAdmin();
  await markSentManually(assignmentId);
  back(`/admin/campaigns/${campaignId}`, "送信済みにしました");
}

export async function removeAssignment(campaignId: string, assignmentId: string) {
  await requireAdmin();
  await db.remove("assignments", assignmentId);
  back(`/admin/campaigns/${campaignId}`, "依頼を取り消しました（発信者への連絡は必要に応じて行ってください）");
}

export async function confirmScheduleAction(campaignId: string, fd: FormData) {
  await requireAdmin();
  const picks: Record<string, { slotId?: string; postDate?: string; note?: string }> = {};
  for (const [k, v] of fd.entries()) {
    const m = k.match(/^(slot|post|note)_(.+)$/);
    if (!m) continue;
    const entry = (picks[m[2]] ??= {});
    if (m[1] === "slot") entry.slotId = String(v) || undefined;
    else if (m[1] === "note") entry.note = String(v).trim().slice(0, 1000) || undefined;
    else entry.postDate = ymd.safeParse(String(v)).success ? String(v) : undefined;
  }
  const result = await confirmSchedule(campaignId, picks, str(fd, "note").slice(0, 2000) || undefined);
  back(`/admin/campaigns/${campaignId}`, summarize("撮影日の確定連絡", result));
}

export async function rescheduleAction(campaignId: string, assignmentId: string, fd: FormData) {
  await requireAdmin();
  try {
    const r = await requestReschedule(assignmentId, str(fd, "reason") || undefined);
    back(
      `/admin/campaigns/${campaignId}`,
      r.ok
        ? "日程の再調整をお願いしました。選び直した結果は「回答の集計」に集まります"
        : `!回答画面は開きましたが、自動で連絡できませんでした（${r.error}）。本人に直接ご連絡ください`,
    );
  } catch (e) {
    if (e instanceof Error && !("digest" in e)) back(`/admin/campaigns/${campaignId}`, `!${e.message}`);
    throw e;
  }
}

export async function markConfirmedAction(campaignId: string, assignmentId: string) {
  await requireAdmin();
  await markConfirmedManually(assignmentId);
  back(`/admin/campaigns/${campaignId}`, "確定連絡済みにしました");
}

export async function shareScheduleAction(campaignId: string, manual: boolean) {
  await requireAdmin();
  const r = await shareScheduleWithRestaurant(campaignId, manual);
  if (manual) back(`/admin/campaigns/${campaignId}`, "飲食店へ共有済みにしました");
  back(
    `/admin/campaigns/${campaignId}`,
    r?.ok
      ? `飲食店へ撮影日を${r.channel === "line" ? "公式LINE" : "メール"}で共有しました`
      : `!自動で送れませんでした：${r?.error}\n文面をコピーして送り、「共有済みにする」を押してください`,
  );
}

export async function setLiveShare(campaignId: string, on: boolean) {
  await requireAdmin();
  await db.update("campaigns", campaignId, (c) => ({ ...c, liveShare: on }));
  back(`/admin/campaigns/${campaignId}`, on ? "飲食店ページで撮影・投稿の状況をリアルタイムに公開しました" : "リアルタイム公開をオフにしました（「共有」した日程だけが表示されます）");
}

export async function insightRequestAction(campaignId: string) {
  await requireAdmin();
  const result = await sendInsightRequests({ campaignId });
  back(`/admin/campaigns/${campaignId}`, summarize("インサイト提出のお願い", result));
}

export async function saveReportComment(campaignId: string, fd: FormData) {
  await requireAdmin();
  await db.update("campaigns", campaignId, (c) => ({
    ...c,
    reportComment: str(fd, "reportComment") || undefined,
    reportPeriod: str(fd, "reportPeriod") || undefined,
    reportFindings: str(fd, "reportFindings") || undefined,
    reportProposals: str(fd, "reportProposals") || undefined,
  }));
  back(`/admin/campaigns/${campaignId}`, "レポートの文章を保存しました");
}

export async function draftReportAction(campaignId: string) {
  await requireAdmin();
  const b = await loadBundle(campaignId);
  if (!b) back("/admin", "!案件が見つかりません");
  if (!isAiConfigured()) back(`/admin/campaigns/${campaignId}`, "!AIが未設定です（ANTHROPIC_API_KEY）");
  let d;
  try {
    d = await draftReportText(b.campaign, b.restaurant, buildReport(b));
  } catch (e) {
    console.error("[report draft]", e);
    back(`/admin/campaigns/${campaignId}`, "!下書きを作れませんでした。時間をおいてお試しください");
  }
  await db.update("campaigns", campaignId, (c) => ({
    ...c,
    reportComment: d.summary,
    reportFindings: d.findings.join("\n"),
    reportProposals: d.proposals.map((p) => `${p.title}｜${p.body}`).join("\n"),
  }));
  back(`/admin/campaigns/${campaignId}`, "AIで下書きを作りました。内容を確認・修正してから送付してください");
}

export async function sendReportAction(campaignId: string, manual: boolean) {
  await requireAdmin();
  const r = await sendReportToRestaurant(campaignId, manual);
  if (manual) back(`/admin/campaigns/${campaignId}`, "レポートを送付済みにしました");
  back(
    `/admin/campaigns/${campaignId}`,
    r?.ok
      ? `レポートを飲食店へ${r.channel === "line" ? "公式LINE" : "メール"}で送付しました`
      : `!自動で送れませんでした：${r?.error}\n文面をコピーして送り、「送付済みにする」を押してください`,
  );
}

export async function reopenReport(campaignId: string) {
  await requireAdmin();
  await db.update("campaigns", campaignId, (c) => ({ ...c, reportSentAt: undefined }));
  back(`/admin/campaigns/${campaignId}`, "レポートを未送付に戻しました");
}

/* ---------- 依頼1件の手動編集（DMで返事が来た場合など） ---------- */

export async function saveAssignment(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const a = await db.get("assignments", id);
  if (!a) back("/admin", "!依頼が見つかりません");
  const campaign = await db.get("campaigns", a.campaignId);
  const valid = { has: (id: string) => Boolean(campaign && findSlot(campaign, id)) };
  const status = str(fd, "status") as Assignment["status"];
  const confirmDate = str(fd, "confirmDate");
  const confirmTime = str(fd, "confirmTime");
  // 期間と時間帯から選ぶ案件では、日付と時刻を直接指定して確定日時にできる
  const confirmedSlotId =
    campaign && isFlex(campaign) && ymd.safeParse(confirmDate).success && /^\d{2}:\d{2}$/.test(confirmTime) ? flexSlotId(confirmDate, confirmTime) : optStr(fd, "confirmedSlotId");
  const plannedPostDate = optStr(fd, "plannedPostDate");
  await db.put("assignments", {
    ...a,
    status: ["unsent", "sent", "accepted", "declined"].includes(status) ? status : a.status,
    availableSlotIds: fd.getAll("availableSlotIds").map(String).filter((x) => valid.has(x)),
    confirmedSlotId: confirmedSlotId && valid.has(confirmedSlotId) ? confirmedSlotId : undefined,
    plannedPostDate: plannedPostDate && ymd.safeParse(plannedPostDate).success ? plannedPostDate : undefined,
    postUrl: optStr(fd, "postUrl"),
    note: optStr(fd, "note"),
    offer: optStr(fd, "offer"),
    partySize: [1, 2, 3].includes(Number(str(fd, "partySize"))) ? Number(str(fd, "partySize")) : a.partySize,
    respondedAt: a.respondedAt ?? (status === "accepted" || status === "declined" ? nowIso() : undefined),
  });
  back(`/admin/campaigns/${a.campaignId}`, "依頼の内容を保存しました");
}

/** インサイトの手入力・修正（スクショを見て担当者が入力） */
export async function saveInsightManual(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const a = await db.get("assignments", id);
  if (!a) back("/admin", "!依頼が見つかりません");
  const platform: Platform = str(fd, "platform") === "tiktok" ? "tiktok" : "instagram";
  const metrics: Insight["metrics"] = {};
  const dists: Insight["dists"] = {};
  for (const f of insightFields[platform]) {
    if (f.kind === "dist") {
      const d = parseDistText(str(fd, f.key));
      if (d.length) dists[f.key] = d;
    } else {
      const raw = str(fd, f.key).replace(/[,，\s%秒]/g, "");
      const n = Number(raw);
      if (raw !== "" && Number.isFinite(n) && n >= 0) metrics[f.key] = n;
    }
  }
  const video = str(fd, "isVideo");
  const insight: Insight = {
    platform,
    metrics,
    dists,
    isVideo: video === "yes" ? true : video === "no" ? false : undefined,
    missing: [],
    source: "manual",
    analyzedShots: a.insight?.analyzedShots ?? 0,
    submittedAt: nowIso(),
  };
  insight.missing = missingKeys(insight);
  const empty = Object.keys(metrics).length === 0 && Object.keys(dists).length === 0;
  await db.update("assignments", a.id, (x) => ({ ...x, platform, insight: empty ? undefined : insight }));
  back(`/admin/assignments/${a.id}`, empty ? "インサイトを空にしました" : insight.missing.length ? `保存しました（足りない項目：${insight.missing.map((k) => fieldLabel(platform, k)).join("、")}）` : "保存しました。すべての項目がそろっています");
}

/** スクショ不足を発信者に連絡 */
export async function notifyMissingAction(id: string) {
  await requireAdmin();
  const a = await db.get("assignments", id);
  const creator = a && (await db.get("creators", a.creatorId));
  if (!a || !creator) back("/admin", "!依頼が見つかりません");
  const c = await db.get("campaigns", a.campaignId);
  const r = c ? await db.get("restaurants", c.restaurantId) : null;
  const missing = a.insight ? missingLabels(a.insight) : [];
  const msg = a.insight
    ? await tmsg("insightMissing", {
        発信者名: creator.name,
        店舗名: r?.name ?? c?.title ?? "PR",
        足りない項目: missing.map((l) => `・${l}`).join("\n"),
        送り先: creator.lineUserId ? "このトークに" : "下のページから",
        URL: assignmentUrl(creator, a),
      })
    : await tmsg("insightReminder", { 発信者名: creator.name, 投稿一覧: `・${r?.name ?? c?.title}：未提出\n${assignmentUrl(creator, a)}`, URL: creatorPortalUrl(creator) });
  const res = await sendToCreator(creator, msg, "インサイト不足の連絡（手動）");
  if (res.ok) await db.update("assignments", a.id, (x) => ({ ...x, missingNotifiedAt: nowIso(), missingNotifiedFor: missing.join(",") }));
  back(`/admin/assignments/${a.id}`, res.ok ? "発信者に連絡しました" : `!自動で送れませんでした：${res.error}`);
}

/* ---------- 動画チェック ---------- */

export async function setVideoCheck(campaignId: string, fd: FormData) {
  await requireAdmin();
  const v = str(fd, "videoCheck");
  const mode = v === "direct" || v === "owner_first" ? v : "none";
  await db.update("campaigns", campaignId, (c) => ({ ...c, videoCheck: mode }));
  back(
    `/admin/campaigns/${campaignId}`,
    mode === "none" ? "動画チェックをなしにしました" : mode === "direct" ? "動画チェック：発信者 → お店が直接確認 にしました" : "動画チェック：発信者 → あなたが確認 → お店 にしました",
  );
}

function sendNote(r: { ok: boolean; channel: string; error?: string } | undefined, who: string) {
  if (!r) return "";
  return r.ok ? `${who}に${r.channel === "line" ? "LINE" : "メール"}で連絡しました` : `!${who}に自動で連絡できませんでした（${r.error}）。手動で連絡してください`;
}

export async function ownerVideoAction(assignmentId: string, versionId: string, ok: boolean, fd: FormData) {
  await requireAdmin();
  const comment = str(fd, "comment") || undefined;
  if (!ok && !comment) back(`/admin/assignments/${assignmentId}`, "!修正してほしい内容を書いてください");
  try {
    const r = await ownerDecide(assignmentId, versionId, ok, comment);
    back(
      `/admin/assignments/${assignmentId}`,
      ok
        ? r.shopSent
          ? "OKにして、お店に確認をお願いしました"
          : "!OKにしました。お店はLINE未連携のため、下の「お店にLINEで送る」から確認をお願いしてください"
        : sendNote(r.creator, "発信者") || "修正をお願いしました",
    );
  } catch (e) {
    if (e instanceof VideoError) back(`/admin/assignments/${assignmentId}`, `!${e.message}`);
    throw e;
  }
}

export async function shopVideoAsAdmin(assignmentId: string, versionId: string, ok: boolean, fd: FormData) {
  await requireAdmin();
  const comment = str(fd, "comment") || undefined;
  if (!ok && !comment) back(`/admin/assignments/${assignmentId}`, "!修正してほしい内容を書いてください");
  try {
    const r = await shopDecide(assignmentId, versionId, ok, comment, "admin");
    back(`/admin/assignments/${assignmentId}`, `お店の確認結果（${ok ? "OK" : "修正"}）を記録しました。${sendNote(r, "発信者").replace(/^!/, "")}`);
  } catch (e) {
    if (e instanceof VideoError) back(`/admin/assignments/${assignmentId}`, `!${e.message}`);
    throw e;
  }
}

export async function markVideoSentAction(assignmentId: string, versionId: string) {
  await requireAdmin();
  await markSentToShop(assignmentId, versionId);
  back(`/admin/assignments/${assignmentId}`, "お店に確認をお願いした、と記録しました");
}

export async function unlinkRestaurantLine(id: string) {
  await requireAdmin();
  await db.update("restaurants", id, (r) => ({ ...r, lineUserId: undefined, lineGroupId: undefined, lineLinkCode: newLinkCode() }));
  back(`/admin/restaurants/${id}`, "LINE連携を解除しました（連携コードも新しくなりました）");
}

/* ---------- 飲食店への提案 ---------- */

export async function saveProposalSettings(fd: FormData) {
  await requireAdmin();
  await db.put("settings", {
    id: "proposal",
    taxRate: Math.min(30, Math.max(0, Number(str(fd, "taxRate")) || 0)),
    directionFee: optNum(fd, "directionFee") ?? 0,
    directionFeeLabel: str(fd, "directionFeeLabel") || "ディレクション費",
    validDays: Math.min(365, Math.max(1, Number(str(fd, "validDays")) || 14)),
    notes: str(fd, "notes"),
    showReach: str(fd, "showReach") === "on",
  });
  back("/admin/settings", "提案の設定を保存しました");
}

export async function createProposal(fd: FormData) {
  await requireAdmin();
  // 料金表に最新のフォロワー数を載せる（ホームページと連動している人だけ）
  await syncFollowersFromSite().catch(() => null);
  let restaurantId = str(fd, "restaurantId");
  const newName = str(fd, "newRestaurant");
  if (!restaurantId && newName) {
    const r: Restaurant = { id: shortId(), name: newName, lineLinkCode: newLinkCode(), createdAt: nowIso() };
    await db.put("restaurants", r);
    restaurantId = r.id;
  }
  if (!restaurantId || !(await db.get("restaurants", restaurantId))) back("/admin/proposals", "!提案する店舗を選ぶか、新しい店舗名を入力してください");
  const creatorIds = fd.getAll("creatorId").map(String).filter(Boolean);
  if (creatorIds.length === 0) back("/admin/proposals", "!提案する発信者を選んでください");
  const p = { id: shortId(), restaurantId, creatorIds, request: optStr(fd, "request"), shareToken: newToken(), createdAt: nowIso() };
  await db.put("proposals", p);
  back(`/admin/proposals/${p.id}`, "料金表を作りました。内容を確認して、飲食店に送ってください");
}

export async function saveProposalCreators(id: string, fd: FormData) {
  await requireAdmin();
  const creatorIds = fd.getAll("creatorId").map(String).filter(Boolean);
  if (creatorIds.length === 0) back(`/admin/proposals/${id}`, "!発信者を1人以上選んでください");
  await db.update("proposals", id, (p) => ({
    ...p,
    creatorIds,
    request: optStr(fd, "request"),
    // ライトプランは、今の発信者に含まれる人だけ残す
    text: p.text?.lightPlan ? { ...p.text, lightPlan: lightOf(p.text.lightPlan.creatorIds.filter((x) => creatorIds.includes(x)), creatorIds, p.text.lightPlan.reason) } : p.text,
    updatedAt: nowIso(),
  }));
  back(`/admin/proposals/${id}`, "発信者を変えました（料金表も更新されています）");
}

/** ライトプランは「全員より少ない1人以上」のときだけ有効 */
function lightOf(ids: string[], all: string[], reason?: string) {
  const list = ids.filter((x) => all.includes(x));
  return list.length > 0 && list.length < all.length ? { creatorIds: list, reason } : undefined;
}

export async function saveProposalText(id: string, fd: FormData) {
  await requireAdmin();
  const p = await db.get("proposals", id);
  if (!p) back("/admin/proposals", "!提案が見つかりません");
  const lightIds = fd.getAll("lightId").map(String);
  await db.update("proposals", id, (x) => ({
    ...x,
    text: {
      title: optStr(fd, "title"),
      lightPlan: str(fd, "useLight") === "on" ? lightOf(lightIds, p.creatorIds, optStr(fd, "lightReason")) : undefined,
    },
    updatedAt: nowIso(),
  }));
  back(`/admin/proposals/${id}`, "料金表を保存しました");
}

export async function sendProposal(id: string, manual: boolean) {
  await requireAdmin();
  const p = await db.get("proposals", id);
  const r = p ? await db.get("restaurants", p.restaurantId) : null;
  if (!p || !r) back("/admin/proposals", "!提案が見つかりません");
  if (manual) {
    await db.update("proposals", id, (x) => ({ ...x, sentAt: nowIso() }));
    back(`/admin/proposals/${id}`, "送付済みにしました");
  }
  const res = await sendToRestaurant(r, await proposalShareMsg(p, r), `料金のご案内：${r.name}`);
  if (res.ok) await db.update("proposals", id, (x) => ({ ...x, sentAt: nowIso() }));
  back(
    `/admin/proposals/${id}`,
    res.ok ? `飲食店へ${res.channel === "line" ? "公式LINE" : "メール"}で提案を送りました` : `!自動で送れませんでした：${res.error}\n文面をコピーして送り、「送付済みにする」を押してください`,
  );
}

export async function deleteProposal(id: string) {
  await requireAdmin();
  await db.remove("proposals", id);
  back("/admin/proposals", "提案を削除しました");
}

/* ---------- メッセージの文面 ---------- */

export async function saveTemplate(key: TemplateKey, fd: FormData) {
  await requireAdmin();
  const go = (flash: string): never => redirect(`/admin/settings/messages?flash=${encodeURIComponent(flash)}#${key}`);
  if (!TEMPLATE_KEYS.includes(key)) go("!文面が見つかりません");
  const body = String(fd.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  const subject = fd.has("subject") ? String(fd.get("subject") ?? "").trim() : undefined;
  if (!body) go("!本文が空です");
  if (body.length > 4000) go("!本文が長すぎます（4000文字まで）");
  const unknown = [...unknownPlaceholders(body, key), ...(subject ? unknownPlaceholders(subject, key) : [])];
  if (unknown.length) go(`!使えない差し込み項目があります：${[...new Set(unknown)].map((u) => `{${u}}`).join("、")}\n下に出ている項目から選んでください`);
  await db.put("templates", { id: key, body, subject, updatedAt: nowIso() });
  go(`「${templateDefs[key].title}」を保存しました。次に送るメッセージから反映されます`);
}

export async function resetTemplate(key: TemplateKey) {
  await requireAdmin();
  await db.remove("templates", key);
  redirect(`/admin/settings/messages?flash=${encodeURIComponent(`「${templateDefs[key].title}」を初期の文面に戻しました`)}#${key}`);
}

export async function resetDemoAction() {
  await requireAdmin();
  if (!isDemo()) back("/admin/settings", "!デモ環境ではありません");
  resetDemo();
  back("/admin", "デモを最初の状態に戻しました");
}

/* ---------- 自動処理を今すぐ実行 ---------- */

export async function runDailyNow() {
  await requireAdmin();
  const r = await runDaily();
  back("/admin/settings", [summarize("リマインド", r.reminders), summarize("インサイト依頼（月末のみ）", r.insights)].join("\n"));
}
