import { NextResponse } from "next/server";
import { opsTemplates } from "@/data/ops-templates";
import { db } from "@/lib/ops/db";
import { lineReply, verifyLineSignature } from "@/lib/ops/line";

/**
 * 公式LINEの Webhook。
 * LINE Developers の Messaging API 設定で Webhook URL を https://<ドメイン>/api/line/webhook にしてください。
 * 発信者が「連携コード」を送ると、その発信者と LINE を紐づけます。
 */
export const dynamic = "force-dynamic";

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
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

  for (const ev of events) {
    try {
      await handle(ev);
    } catch (err) {
      console.error("[line webhook]", err);
    }
  }
  return NextResponse.json({ ok: true });
}

async function handle(ev: LineEvent) {
  const userId = ev.source?.type === "user" ? ev.source.userId : undefined;
  if (!userId || !ev.replyToken) return;

  if (ev.type === "follow") {
    const creators = await db.list("creators");
    const linked = creators.find((c) => c.lineUserId === userId);
    await lineReply(ev.replyToken, linked ? opsTemplates.lineLinked(linked.name) : opsTemplates.lineWelcome);
    return;
  }

  if (ev.type !== "message" || ev.message?.type !== "text") return;
  const text = (ev.message.text ?? "").trim().toUpperCase();
  const code = text.match(/^(?:連携[\s:：]*)?([A-Z0-9]{6})$/)?.[1];
  if (!code) return; // 通常のメッセージは担当者がLINEの管理画面で対応

  const creators = await db.list("creators");
  const creator = creators.find((c) => c.lineLinkCode === code);
  if (!creator) {
    await lineReply(ev.replyToken, opsTemplates.lineUnknown);
    return;
  }
  // 同じLINEが別の発信者に紐づいていたら外す
  for (const other of creators.filter((c) => c.lineUserId === userId && c.id !== creator.id)) {
    await db.put("creators", { ...other, lineUserId: undefined });
  }
  await db.put("creators", { ...creator, lineUserId: userId });
  await lineReply(ev.replyToken, opsTemplates.lineLinked(creator.name));
}
