"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { checkPassword, endSession, requireAdmin, startSession } from "@/lib/ops/auth";
import { db, resetDemo } from "@/lib/ops/db";
import { isDemo } from "@/lib/ops/demo-flag";
import type { BulkResult } from "@/lib/ops/service";
import {
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
import { opsTemplates } from "@/data/ops-templates";
import { fieldLabel, insightFields, missingKeys, missingLabels, parseDistText } from "@/lib/ops/insight-fields";
import { draftReportText } from "@/lib/ops/ai-report";
import { buildReport } from "@/lib/ops/report";
import { isAiConfigured } from "@/lib/ops/vision";
import { sendToCreator } from "@/lib/ops/notify";
import { assignmentUrl } from "@/lib/ops/urls";
import type { Assignment, Campaign, Creator, Insight, Platform, Restaurant, Slot } from "@/lib/ops/types";
import { newLinkCode, newToken, nowIso, shortId } from "@/lib/ops/util";
import { isRateLimited } from "@/lib/spam";
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
  const patch = {
    name,
    account,
    platform: str(fd, "platform") || "Instagram",
    followers: optNum(fd, "followers"),
    email,
    memo: optStr(fd, "memo"),
  };
  if (id) {
    await db.update("creators", id, (c) => ({ ...c, ...patch }));
    back(`/admin/creators/${id}`, "保存しました");
  }
  const creator: Creator = { id: shortId(), ...patch, token: newToken(), lineLinkCode: newLinkCode(), active: true, createdAt: nowIso() };
  await db.put("creators", creator);
  back(`/admin/creators/${creator.id}`, "登録しました。下の「最初の案内文」を本人に送ってください");
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
  const patch = {
    name,
    contactName: optStr(fd, "contactName"),
    email,
    phone: optStr(fd, "phone"),
    address: optStr(fd, "address"),
    memo: optStr(fd, "memo"),
  };
  if (id) {
    await db.update("restaurants", id, (r) => ({ ...r, ...patch }));
    back(path, "保存しました");
  }
  const r: Restaurant = { id: shortId(), ...patch, createdAt: nowIso() };
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
  const slots = readSlots(fd, prev?.slots);
  if (slots.length === 0) back(path, "!撮影候補日を1つ以上入力してください");
  const patch = {
    restaurantId,
    title,
    description: str(fd, "description"),
    offer: str(fd, "offer"),
    conditions: str(fd, "conditions"),
    slots,
    replyDeadline,
    postDates,
    postDeadline,
  };
  if (prev) {
    await db.put("campaigns", { ...prev, ...patch });
    back(`/admin/campaigns/${prev.id}`, "保存しました");
  }
  const c: Campaign = { id: shortId(), ...patch, shareToken: newToken(), liveShare: true, createdAt: nowIso() };
  await db.put("campaigns", c);
  back(`/admin/campaigns/${c.id}`, "案件を作成しました。次に依頼する発信者を選んで一括送信してください");
}

export async function deleteCampaign(id: string) {
  await requireAdmin();
  for (const a of (await db.list("assignments")).filter((a) => a.campaignId === id)) await db.remove("assignments", a.id);
  await db.remove("campaigns", id);
  back("/admin", "案件を削除しました");
}

export async function sendRequestsAction(campaignId: string, fd: FormData) {
  await requireAdmin();
  const ids = fd.getAll("creatorId").map(String).filter(Boolean);
  if (ids.length === 0) back(`/admin/campaigns/${campaignId}`, "!依頼する発信者を選んでください");
  const result = await sendRequests(campaignId, ids);
  back(`/admin/campaigns/${campaignId}`, summarize("PR依頼", result));
}

/** 実施済みの案件に、発信者を「参加・撮影済み」として記録だけ追加する（連絡はしない） */
export async function addPastParticipants(campaignId: string, fd: FormData) {
  await requireAdmin();
  const c = await db.get("campaigns", campaignId);
  if (!c) back("/admin", "!案件が見つかりません");
  const ids = fd.getAll("creatorId").map(String).filter(Boolean);
  if (ids.length === 0) back(`/admin/campaigns/${campaignId}`, "!記録する発信者を選んでください");
  const slotId = c.slots.find((s) => s.id === str(fd, "slotId"))?.id ?? c.slots[0]?.id;
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
      respondedAt: t,
      confirmedNotifiedAt: t,
      createdAt: t,
    });
    added++;
  }
  back(`/admin/campaigns/${campaignId}`, `${added}人を実施済みとして記録しました（連絡はしていません）。下の「インサイトのスクショ回収」から各発信者のスクショを追加するか、提出のお願いを送ってください`);
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
  const picks: Record<string, { slotId?: string; postDate?: string }> = {};
  for (const [k, v] of fd.entries()) {
    const m = k.match(/^(slot|post)_(.+)$/);
    if (!m) continue;
    const entry = (picks[m[2]] ??= {});
    if (m[1] === "slot") entry.slotId = String(v) || undefined;
    else entry.postDate = ymd.safeParse(String(v)).success ? String(v) : undefined;
  }
  const result = await confirmSchedule(campaignId, picks);
  back(`/admin/campaigns/${campaignId}`, summarize("撮影日の確定連絡", result));
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
  back(`/admin/campaigns/${campaignId}`, r?.ok ? "飲食店へ撮影日をメールで共有しました" : `!メールを送れませんでした：${r?.error}\n文面をコピーして送り、「共有済みにする」を押してください`);
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
  back(`/admin/campaigns/${campaignId}`, r?.ok ? "レポートを飲食店へメールで送付しました" : `!メールを送れませんでした：${r?.error}\n文面をコピーして送り、「送付済みにする」を押してください`);
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
  const valid = new Set(campaign?.slots.map((s) => s.id));
  const status = str(fd, "status") as Assignment["status"];
  const confirmedSlotId = optStr(fd, "confirmedSlotId");
  const plannedPostDate = optStr(fd, "plannedPostDate");
  await db.put("assignments", {
    ...a,
    status: ["unsent", "sent", "accepted", "declined"].includes(status) ? status : a.status,
    availableSlotIds: fd.getAll("availableSlotIds").map(String).filter((x) => valid.has(x)),
    confirmedSlotId: confirmedSlotId && valid.has(confirmedSlotId) ? confirmedSlotId : undefined,
    plannedPostDate: plannedPostDate && ymd.safeParse(plannedPostDate).success ? plannedPostDate : undefined,
    postUrl: optStr(fd, "postUrl"),
    note: optStr(fd, "note"),
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
    ? opsTemplates.insightMissing({ creator: creator.name, post: r?.name ?? c?.title ?? "PR", missing, url: assignmentUrl(creator, a), viaLine: Boolean(creator.lineUserId) })
    : opsTemplates.insightReminder({ creator: creator.name, lines: [`・${r?.name ?? c?.title}：未提出`], url: assignmentUrl(creator, a) });
  const res = await sendToCreator(creator, msg, "インサイト不足の連絡（手動）");
  if (res.ok) await db.update("assignments", a.id, (x) => ({ ...x, missingNotifiedAt: nowIso(), missingNotifiedFor: missing.join(",") }));
  back(`/admin/assignments/${a.id}`, res.ok ? "発信者に連絡しました" : `!自動で送れませんでした：${res.error}`);
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
