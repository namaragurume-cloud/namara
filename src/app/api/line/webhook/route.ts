import { after, NextResponse } from "next/server";
import { db } from "@/lib/ops/db";
import { analyzeAssignment, listShots, needsInsight, saveShot, ShotError } from "@/lib/ops/insights";
import { lineGetContent, lineReply, verifyLineSignature } from "@/lib/ops/line";
import { text as tmpl } from "@/lib/ops/templates";
import { creatorPortalUrl } from "@/lib/ops/urls";
import { isAiConfigured } from "@/lib/ops/vision";

/**
 * 公式LINEの Webhook。
 * LINE Developers の Messaging API 設定で Webhook URL を https://<ドメイン>/api/line/webhook にしてください。
 * 発信者が「連携コード」を送ると、その発信者と LINE を紐づけます。
 */
export const dynamic = "force-dynamic";
/** 画像を受け取ってからAIで読み取るまで待つため長めに */
export const maxDuration = 120;

/** 続けて送られてくる画像をまとめて読むための待ち時間 */
const SETTLE_MS = 20_000;

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string; groupId?: string; roomId?: string };
  message?: { id: string; type: string; text?: string };
};

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyLineSignature(raw, req.headers.get("x-line-signature"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let events: LineEvent[] = [];
  try {
    events = (JSON.parse(raw) as { events?: LineEvent[] }).events ?? [];
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const received = new Set<string>();
  for (const ev of events) {
    try {
      await handle(ev, received);
    } catch (err) {
      console.error("[line webhook]", err);
    }
  }

  // 画像を受け取った投稿は、少し待ってから（続きの画像がそろってから）まとめて読み取る
  received.delete("__replied__");
  for (const assignmentId of isAiConfigured() ? received : []) {
    const lastBefore = (await listShots(assignmentId)).at(-1)?.id;
    after(async () => {
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      // この間に新しい画像が届いていれば、そちらの処理に任せる
      if ((await listShots(assignmentId)).at(-1)?.id !== lastBefore) return;
      await analyzeAssignment(assignmentId, { notify: true, viaLine: true });
    });
  }
  return NextResponse.json({ ok: true });
}

async function handle(ev: LineEvent, received: Set<string>) {
  // お店のLINEグループ（複数人トーク）からのイベント
  if (ev.source?.type === "group" || ev.source?.type === "room") {
    const groupId = ev.source.groupId ?? ev.source.roomId;
    if (groupId) await handleGroup(ev, groupId);
    return;
  }
  const userId = ev.source?.type === "user" ? ev.source.userId : undefined;
  if (!userId || !ev.replyToken) return;

  if (ev.type === "follow") {
    const creators = await db.list("creators");
    const linked = creators.find((c) => c.lineUserId === userId);
    const shop = linked ? undefined : (await db.list("restaurants")).find((r) => r.lineUserId === userId);
    await lineReply(
      ev.replyToken,
      linked ? await tmpl("lineLinked", { 発信者名: linked.name }) : shop ? await tmpl("restaurantLinked", { 店舗名: shop.name }) : await tmpl("lineWelcome"),
    );
    return;
  }

  if (ev.type === "message" && ev.message?.type === "image") {
    await handleImage(ev, userId, received);
    return;
  }
  if (ev.type !== "message" || ev.message?.type !== "text") return;
  const text = (ev.message.text ?? "").trim().toUpperCase();
  const code = text.match(/^(?:連携[\s:：]*)?([A-Z0-9]{6})$/)?.[1];
  if (!code) return; // 通常のメッセージは担当者がLINEの管理画面で対応

  const creators = await db.list("creators");
  const creator = creators.find((c) => c.lineLinkCode === code);
  if (!creator) {
    // 飲食店の連携コード
    const restaurants = await db.list("restaurants");
    const shop = restaurants.find((r) => r.lineLinkCode === code);
    if (shop) {
      for (const other of restaurants.filter((r) => r.lineUserId === userId && r.id !== shop.id)) await db.put("restaurants", { ...other, lineUserId: undefined });
      await db.put("restaurants", { ...shop, lineUserId: userId });
      await lineReply(ev.replyToken, await tmpl("restaurantLinked", { 店舗名: shop.name }));
      return;
    }
    await lineReply(ev.replyToken, await tmpl("lineUnknown"));
    return;
  }
  // 同じLINEが別の発信者に紐づいていたら外す
  for (const other of creators.filter((c) => c.lineUserId === userId && c.id !== creator.id)) {
    await db.put("creators", { ...other, lineUserId: undefined });
  }
  await db.put("creators", { ...creator, lineUserId: userId });
  await lineReply(ev.replyToken, await tmpl("lineLinked", { 発信者名: creator.name }));
}

/** インサイトのスクショをLINEで受け取る */
async function handleImage(ev: LineEvent, userId: string, received: Set<string>) {
  const replyToken = ev.replyToken!;
  const creator = (await db.list("creators")).find((c) => c.lineUserId === userId && c.active);
  if (!creator) return; // 未連携の人の画像は担当者がLINEの管理画面で確認
  const [assignments, campaigns] = await Promise.all([db.list("assignments"), db.list("campaigns")]);
  const open = new Map(campaigns.filter((c) => !c.reportSentAt).map((c) => [c.id, c]));
  const pending = assignments.filter((a) => a.creatorId === creator.id && open.has(a.campaignId) && needsInsight(a));
  // 依頼済みの投稿を優先して、1件に決められるか
  const requested = pending.filter((a) => a.insightRequestedAt);
  const target = pending.length === 1 ? pending[0] : requested.length === 1 ? requested[0] : undefined;

  if (!target) {
    if (received.size > 0) return; // 同じ送信で既に返信済み
    received.add("__replied__");
    await lineReply(
      replyToken,
      pending.length === 0
        ? `${creator.name}さん、画像ありがとうございます！今インサイトをお願いしている投稿はないため、担当者が確認します。`
        : await tmpl("insightWhichPost", { 発信者名: creator.name, URL: creatorPortalUrl(creator) }),
    );
    return;
  }
  try {
    const content = await lineGetContent(ev.message!.id);
    await saveShot(target, { via: "line", mediaType: content.mediaType, data: content.data });
    received.add(target.id);
  } catch (e) {
    await lineReply(replyToken, e instanceof ShotError ? e.message : "画像を受け取れませんでした。もう一度送ってください。");
    return;
  }
  if (!isAiConfigured()) {
    // 自動読み取りが未設定なら、担当者が画像を見て入力する
    await lineReply(replyToken, `${creator.name}さん、画像を受け取りました。ありがとうございます！`).catch(() => {});
  }
}

/**
 * お店のLINEグループ。グループで連携コードが送られたら、そのお店とグループを紐づける。
 * グループ内の普段の会話には反応しない。
 */
async function handleGroup(ev: LineEvent, groupId: string) {
  if (ev.type === "leave") {
    // 公式LINEがグループから外された
    for (const r of (await db.list("restaurants")).filter((r) => r.lineGroupId === groupId)) await db.put("restaurants", { ...r, lineGroupId: undefined });
    return;
  }
  if (!ev.replyToken) return;
  if (ev.type === "join") {
    const linked = (await db.list("restaurants")).find((r) => r.lineGroupId === groupId);
    await lineReply(ev.replyToken, linked ? await tmpl("restaurantLinked", { 店舗名: linked.name }) : await tmpl("lineGroupJoined"));
    return;
  }
  if (ev.type !== "message" || ev.message?.type !== "text") return;
  const code = (ev.message.text ?? "").trim().toUpperCase().match(/^(?:連携[\s:：]*)?([A-Z0-9]{6})$/)?.[1];
  if (!code) return;
  const restaurants = await db.list("restaurants");
  const shop = restaurants.find((r) => r.lineLinkCode === code);
  if (!shop) {
    if ((await db.list("creators")).some((c) => c.lineLinkCode === code)) {
      await lineReply(ev.replyToken, "発信者の方の連携コードは、グループではなく公式LINEとの1対1のトークに送ってください。");
    }
    return;
  }
  for (const other of restaurants.filter((r) => r.lineGroupId === groupId && r.id !== shop.id)) await db.put("restaurants", { ...other, lineGroupId: undefined });
  await db.put("restaurants", { ...shop, lineGroupId: groupId });
  await lineReply(ev.replyToken, await tmpl("restaurantLinked", { 店舗名: shop.name }));
}
