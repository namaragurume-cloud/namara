import "server-only";
import { blobs, db } from "./db";
import { fieldLabel, isComplete, missingKeys, platformLabel } from "./insight-fields";
import { sendToCreator } from "./notify";
import type { Assignment, Creator, Insight, Platform, Shot } from "./types";
import { assignmentUrl } from "./urls";
import { msg } from "./templates";
import { nowIso, shortId } from "./util";
import { extractInsight, isAiConfigured } from "./vision";

export const MAX_SHOTS = 12;
/** 1枚あたりの上限（Claude API の画像上限 5MB に合わせる） */
export const MAX_SHOT_BYTES = 4_500_000;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function listShots(assignmentId: string): Promise<Shot[]> {
  return (await db.list("shots")).filter((s) => s.assignmentId === assignmentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export class ShotError extends Error {}

export async function saveShot(a: Assignment, input: { via: Shot["via"]; mediaType: string; data: Buffer }): Promise<Shot> {
  if (!TYPES.has(input.mediaType)) throw new ShotError("画像（JPEG・PNG）を送ってください");
  if (input.data.length > MAX_SHOT_BYTES) throw new ShotError("画像が大きすぎます");
  if ((await listShots(a.id)).length >= MAX_SHOTS) throw new ShotError(`画像は1投稿につき${MAX_SHOTS}枚までです`);
  const shot: Shot = {
    id: `${Date.now().toString(36)}${shortId()}`,
    assignmentId: a.id,
    creatorId: a.creatorId,
    via: input.via,
    mediaType: input.mediaType,
    bytes: input.data.length,
    createdAt: nowIso(),
  };
  await blobs.set(shot.id, input.data.toString("base64"));
  await db.put("shots", shot);
  return shot;
}

export async function deleteShot(shot: Shot): Promise<void> {
  await db.remove("shots", shot.id);
  await blobs.del(shot.id).catch(() => {});
}

/** 依頼先の店舗名など、メッセージ用の投稿の呼び名 */
async function postName(a: Assignment): Promise<string> {
  const c = await db.get("campaigns", a.campaignId);
  const r = c ? await db.get("restaurants", c.restaurantId) : null;
  return r?.name ?? c?.title ?? "PR";
}

export type AnalyzeResult =
  | { status: "ok"; insight: Insight; missing: string[] }
  | { status: "no-ai" }
  | { status: "no-shots" }
  | { status: "stale" }
  | { status: "error"; message: string };

/**
 * その投稿のスクショをすべてまとめてAIで読み取り、インサイトを保存する。
 * notify=true なら、不足があれば発信者に連絡（同じ内容は二度送らない）。そろったときもお礼を送る。
 */
export async function analyzeAssignment(assignmentId: string, opts: { notify: boolean; viaLine?: boolean }): Promise<AnalyzeResult> {
  const a = await db.get("assignments", assignmentId);
  if (!a) return { status: "error", message: "依頼が見つかりません" };
  if (!isAiConfigured()) return { status: "no-ai" };
  const shots = await listShots(a.id);
  if (shots.length === 0) return { status: "no-shots" };
  const images = (
    await Promise.all(shots.map(async (s) => ({ mediaType: s.mediaType, base64: await blobs.get(s.id) })))
  ).flatMap((x) => (x.base64 ? [{ mediaType: x.mediaType, base64: x.base64 }] : []));
  if (images.length === 0) return { status: "no-shots" };

  const creator = await db.get("creators", a.creatorId);
  const hint: Platform | undefined = a.platform ?? (creator?.platform.toLowerCase().includes("tiktok") ? "tiktok" : undefined);
  let ex;
  try {
    ex = await extractInsight(images, hint);
  } catch (err) {
    console.error("[insight] extract failed", err);
    return { status: "error", message: "画像の読み取りに失敗しました。時間をおいてもう一度お試しください。" };
  }
  const platform: Platform = ex.platform ?? hint ?? "instagram";

  const latest = await db.get("assignments", a.id);
  if (!latest) return { status: "error", message: "依頼が見つかりません" };
  // 後から届いた画像で、より新しい読み取りが済んでいれば上書きしない
  if (latest.insight && latest.insight.analyzedShots > images.length && latest.insight.source === "ai") return { status: "stale" };

  const prev = latest.insight?.platform === platform ? latest.insight : undefined;
  // 管理画面で手入力した値は優先し、AIは空いている項目だけ埋める
  const base = prev?.source === "manual" ? prev : undefined;
  const insight: Insight = {
    platform,
    metrics: { ...ex.metrics, ...(base?.metrics ?? {}) },
    dists: { ...ex.dists, ...(base?.dists ?? {}) },
    isVideo: base?.isVideo ?? ex.isVideo,
    missing: [],
    source: base ? "manual" : "ai",
    analyzedShots: images.length,
    aiNote: [ex.note, ex.unrelatedImages ? `インサイト以外の画像が${ex.unrelatedImages}枚ありました` : ""].filter(Boolean).join(" / ") || undefined,
    submittedAt: nowIso(),
  };
  insight.missing = missingKeys(insight);

  await db.update("assignments", a.id, (x) => ({
    ...x,
    platform,
    insight,
    plannedPostDate: x.plannedPostDate ?? ex.postedOn,
  }));

  if (opts.notify && creator) await notifyInsightResult(latest, creator, insight, Boolean(opts.viaLine));
  return { status: "ok", insight, missing: insight.missing.map((k) => fieldLabel(platform, k)) };
}

async function notifyInsightResult(a: Assignment, creator: Creator, insight: Insight, viaLine: boolean) {
  const post = await postName(a);
  if (isComplete(insight)) {
    // ページから送った人には画面で伝わるので、LINEで送ってきた人にだけお礼を返す
    if (viaLine) await sendToCreator(creator, await msg("insightComplete", { 発信者名: creator.name, 店舗名: post }), "インサイト受領");
    await db.update("assignments", a.id, (x) => ({ ...x, missingNotifiedFor: undefined }));
    return;
  }
  const labels = insight.missing.map((k) => fieldLabel(insight.platform, k));
  const key = labels.join(",");
  if (a.missingNotifiedFor === key) return;
  const r = await sendToCreator(
    creator,
    await msg("insightMissing", { 発信者名: creator.name, 店舗名: post, 足りない項目: labels.map((l) => `・${l}`).join("\n"), 送り先: viaLine ? "このトークに" : "下のページから", URL: assignmentUrl(creator, a) }),
    `インサイト不足の連絡（${platformLabel[insight.platform]}）`,
  );
  if (r.ok) await db.update("assignments", a.id, (x) => ({ ...x, missingNotifiedAt: nowIso(), missingNotifiedFor: key }));
}

/** インサイトを集めている（まだそろっていない）依頼 */
export function needsInsight(a: Assignment): boolean {
  return a.status === "accepted" && Boolean(a.confirmedSlotId) && !isComplete(a.insight);
}
