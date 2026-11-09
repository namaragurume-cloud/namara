import "server-only";
import { db } from "./db";
import { fmtDate, fmtPostDates } from "./dates";
import { sendToCreator, sendToRestaurant, type SendResult } from "./notify";
import { msg } from "./templates";
import type { Assignment, Campaign, Creator, Restaurant, VideoDecision, VideoVersion } from "./types";
import { assignmentUrl, restaurantPortalUrl } from "./urls";
import { nowIso, shortId } from "./util";
import { latestVideo, videoStage } from "./video-state";
import { deleteVideoFile } from "./video-store";

type Ctx = { a: Assignment; c: Campaign; creator: Creator; restaurant: Restaurant | null };

async function load(assignmentId: string): Promise<Ctx | null> {
  const a = await db.get("assignments", assignmentId);
  if (!a) return null;
  const [c, creator] = await Promise.all([db.get("campaigns", a.campaignId), db.get("creators", a.creatorId)]);
  if (!c || !creator) return null;
  return { a, c, creator, restaurant: await db.get("restaurants", c.restaurantId) };
}

const postDateOf = (x: Ctx) => (x.a.plannedPostDate ? fmtDate(x.a.plannedPostDate) : fmtPostDates(x.c));

const shopMsg = (x: Ctx) =>
  msg("restaurantVideoCheck", {
    店舗名: x.restaurant?.name ?? "",
    宛名: x.restaurant?.contactName ? `${x.restaurant.contactName}様` : "ご担当者様",
    発信者名: x.creator.name,
    URL: `${restaurantPortalUrl(x.c)}#video`,
    投稿日: postDateOf(x),
  });

/** 飲食店へ確認のお願いを送る（連携していなければ手動扱い） */
async function askShop(x: Ctx): Promise<SendResult | null> {
  if (!x.restaurant) return null;
  const r = await sendToRestaurant(x.restaurant, await shopMsg(x), `動画の確認依頼：${x.creator.name}`);
  return r;
}

/** 手動で送るときの文面（管理画面のコピー用） */
export async function shopVideoText(assignmentId: string): Promise<string | null> {
  const x = await load(assignmentId);
  return x ? (await shopMsg(x)).text : null;
}

/** 動画を登録（アップロード完了後） */
export async function addVideo(assignmentId: string, v: Omit<VideoVersion, "id" | "uploadedAt">): Promise<{ next: "owner" | "shop"; shopSent: boolean }> {
  const version: VideoVersion = { ...v, id: `${Date.now().toString(36)}${shortId()}`, uploadedAt: nowIso() };
  await db.update("assignments", assignmentId, (a) => ({ ...a, videos: [...(a.videos ?? []), version] }));
  const x = (await load(assignmentId))!;
  if (x.c.videoCheck === "owner_first") return { next: "owner", shopSent: false };
  const r = await askShop(x);
  if (r?.ok) await markSentToShop(assignmentId, version.id);
  return { next: "shop", shopSent: Boolean(r?.ok) };
}

export async function markSentToShop(assignmentId: string, versionId: string): Promise<void> {
  await db.update("assignments", assignmentId, (a) => ({
    ...a,
    videos: (a.videos ?? []).map((v) => (v.id === versionId ? { ...v, sentToShopAt: v.sentToShopAt ?? nowIso() } : v)),
  }));
}

function setDecision(a: Assignment, versionId: string, field: "owner" | "shop", d: VideoDecision): Assignment {
  return { ...a, videos: (a.videos ?? []).map((v) => (v.id === versionId ? { ...v, [field]: d } : v)) };
}

async function tellCreator(x: Ctx, ok: boolean, comment?: string) {
  const vars = { 発信者名: x.creator.name, 店舗名: x.restaurant?.name ?? x.c.title, URL: assignmentUrl(x.creator, x.a) };
  return ok
    ? sendToCreator(x.creator, await msg("videoApproved", { ...vars, 投稿日: postDateOf(x) }), `動画OK：${x.c.title}`)
    : sendToCreator(x.creator, await msg("videoRevision", { ...vars, 修正内容: comment || "（コメントなし）" }), `動画の修正依頼：${x.c.title}`);
}

export class VideoError extends Error {}

/** あなたのチェック（「先に確認」の案件） */
export async function ownerDecide(assignmentId: string, versionId: string, ok: boolean, comment?: string): Promise<{ shopSent?: boolean; creator?: SendResult }> {
  const x = await load(assignmentId);
  const v = x && latestVideo(x.a);
  if (!x || !v || v.id !== versionId) throw new VideoError("最新の動画ではありません");
  if (videoStage(x.a, x.c) !== "owner_review") throw new VideoError("この動画はすでに確認済みです");
  await db.update("assignments", assignmentId, (a) => setDecision(a, versionId, "owner", { status: ok ? "ok" : "ng", comment, at: nowIso(), by: "admin" }));
  if (!ok) return { creator: await tellCreator(x, false, comment) };
  const r = await askShop(x);
  if (r?.ok) await markSentToShop(assignmentId, versionId);
  return { shopSent: Boolean(r?.ok) };
}

/** 飲食店の確認（お店のページ、またはあなたが代わりに入力） */
export async function shopDecide(assignmentId: string, versionId: string, ok: boolean, comment: string | undefined, by: "shop" | "admin", name?: string): Promise<SendResult> {
  const x = await load(assignmentId);
  const v = x && latestVideo(x.a);
  if (!x || !v || v.id !== versionId) throw new VideoError("最新の動画ではありません");
  if (videoStage(x.a, x.c) !== "shop_review") throw new VideoError("この動画はすでに確認済みです");
  await db.update("assignments", assignmentId, (a) => setDecision(a, versionId, "shop", { status: ok ? "ok" : "ng", comment, at: nowIso(), by, name }));
  return tellCreator(x, ok, comment);
}

/** 投稿が済んだ（URL・インサイトが届いた、または投稿日から7日）動画ファイルを削除して容量を空ける */
export async function cleanupVideos(today: string): Promise<number> {
  let n = 0;
  for (const a of await db.list("assignments")) {
    const files = (a.videos ?? []).filter((v) => !v.fileDeletedAt);
    if (!files.length) continue;
    const posted = Boolean(a.postUrl || a.insight) || Boolean(a.plannedPostDate && a.plannedPostDate < addDaysIso(today, -7));
    if (!posted) continue;
    for (const v of files) await deleteVideoFile(v);
    await db.update("assignments", a.id, (x) => ({ ...x, videos: (x.videos ?? []).map((v) => (v.fileDeletedAt ? v : { ...v, fileDeletedAt: nowIso() })) }));
    n += files.length;
  }
  return n;
}

const addDaysIso = (ymd: string, d: number) => {
  const t = new Date(`${ymd}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};

/** 依頼を削除するとき、動画ファイルも消す */
export async function deleteAllVideoFiles(a: Assignment): Promise<void> {
  for (const v of a.videos ?? []) await deleteVideoFile(v);
}
