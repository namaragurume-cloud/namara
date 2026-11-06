import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isDemo } from "./demo-flag";

/**
 * LINE 公式アカウント（Messaging API）
 *   LINE_CHANNEL_ACCESS_TOKEN : 長期のチャネルアクセストークン
 *   LINE_CHANNEL_SECRET       : Webhook の署名検証に使用
 *   LINE_BOT_BASIC_ID         : 公式アカウントのベーシックID（@xxxxxxx）。連携ボタンに使用
 */

export function isLineConfigured(): boolean {
  if (isDemo()) return true;
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET);
}

export function lineBasicId(): string | undefined {
  const id = process.env.LINE_BOT_BASIC_ID?.trim();
  if (!id) return undefined;
  return id.startsWith("@") ? id : `@${id}`;
}

/** 公式LINEのトークを開き、メッセージを入力済みにするURL */
export function lineOaMessageUrl(text: string): string | undefined {
  const id = lineBasicId();
  if (!id) return undefined;
  return `https://line.me/R/oaMessage/${encodeURIComponent(id)}/?${encodeURIComponent(text)}`;
}

/** 自分のLINEから手動で送るときの共有URL（送信先は自分で選ぶ） */
export function lineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}

async function call(path: string, body: unknown): Promise<void> {
  const res = await fetch(`https://api.line.me/v2/bot/message/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`LINE ${path} ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  }
}

/** LINEのテキストは1通5000文字まで */
const clip = (t: string) => (t.length > 4900 ? `${t.slice(0, 4900)}…` : t);

export function linePush(to: string, text: string): Promise<void> {
  return call("push", { to, messages: [{ type: "text", text: clip(text) }] });
}

export function lineReply(replyToken: string, text: string): Promise<void> {
  return call("reply", { replyToken, messages: [{ type: "text", text: clip(text) }] });
}

export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** ユーザーが送った画像などを取得 */
export async function lineGetContent(messageId: string): Promise<{ mediaType: string; data: Buffer }> {
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`LINE content ${res.status}`);
  return { mediaType: (res.headers.get("content-type") ?? "image/jpeg").split(";")[0], data: Buffer.from(await res.arrayBuffer()) };
}
