import { after, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { verifyLineSignature } from "@/lib/line/signature";
import { HttpLineClient, MockLineClient, processLineEvents, webhookBodySchema, type LineClient } from "@/lib/line/webhook";

/**
 * なまらAI（消費者向けLINE）の Webhook。
 * Phase 1 では LINE_REPLY_ENABLED=1 を設定しない限り LINE には返信せず、モッククライアントに記録するだけ。
 */
const mockClient = new MockLineClient();

function lineClient(): LineClient {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  return process.env.LINE_REPLY_ENABLED === "1" && token ? new HttpLineClient(token) : mockClient;
}

export async function POST(request: Request) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return NextResponse.json({ error: "LINE is not configured" }, { status: 503 });

  // 署名は必ず生のボディで検証する
  const rawBody = await request.text();
  if (!verifyLineSignature(rawBody, request.headers.get("x-line-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const body = webhookBodySchema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  // LINE には先に 200 を返し、検索と返信はレスポンス後に実行する
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  after(async () => {
    await processLineEvents(body.data.events, { db: getDb(), client: lineClient(), baseUrl });
  });
  return NextResponse.json({ ok: true });
}
