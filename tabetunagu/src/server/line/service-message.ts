import "server-only";
import { errorCategoryForStatus, type ServiceMessageErrorCategory } from "@/lib/service-message";
import { env } from "../env";

/**
 * LINE ミニアプリのサービスメッセージ API（サーバー専用）。
 *   1. channel access token（stateless・15分）: POST https://api.line.me/oauth2/v3/token（client_credentials）
 *   2. サービス通知トークンの発行: POST https://api.line.me/message/v3/notifier/token  { liffAccessToken }
 *      → { notificationToken, expiresIn, remainingCount, sessionId }（1つの LIFF アクセストークンにつき1回だけ。1年間・最大5回送信）
 *   3. 送信: POST https://api.line.me/message/v3/notifier/send?target=service  { templateName, params, notificationToken }
 *      → 新しい notificationToken（送信のたびに更新される。古い値は使わない）
 * LINE Messaging API の通常の Push（友だちへのメッセージ）とは別のもの。
 * シークレット・トークンはログ・レスポンスに出さない。
 */

const API = "https://api.line.me";

export class ServiceMessageError extends Error {
  constructor(
    readonly category: ServiceMessageErrorCategory,
    readonly status?: number,
  ) {
    super(`service_message_${category}`);
  }
}

export type NotifierToken = { notificationToken: string | null; expiresIn: number; remainingCount: number; sessionId: string | null };

let cached: { token: string; expiresAt: number; channelId: string } | null = null;

/** stateless channel access token（15分）。期限の1分前まで使い回す */
export async function channelAccessToken(now = Date.now()): Promise<string> {
  const channelId = env.line.miniAppChannelId;
  const secret = env.line.miniAppChannelSecret;
  if (!channelId || !secret) throw new ServiceMessageError("not_configured");
  if (cached && cached.channelId === channelId && cached.expiresAt - 60_000 > now) return cached.token;
  const res = await safeFetch(`${API}/oauth2/v3/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: channelId, client_secret: secret }),
  });
  if (!res.ok) throw new ServiceMessageError(errorCategoryForStatus(res.status), res.status);
  const data = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!data?.access_token) throw new ServiceMessageError("line_unavailable");
  cached = { token: data.access_token, expiresAt: now + (data.expires_in ?? 900) * 1000, channelId };
  return data.access_token;
}

/** テスト用: キャッシュを消す */
export function resetChannelTokenCache() {
  cached = null;
}

/** LIFF アクセストークンからサービス通知トークンを発行する（LIFF アクセストークンは保存しない） */
export async function issueNotificationToken(liffAccessToken: string): Promise<NotifierToken> {
  const token = await channelAccessToken();
  const res = await safeFetch(`${API}/message/v3/notifier/token`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ liffAccessToken }),
  });
  if (!res.ok) throw new ServiceMessageError(errorCategoryForStatus(res.status), res.status);
  return parseNotifierToken(await res.json().catch(() => null));
}

/** サービスメッセージを1件送る。戻り値の notificationToken（次回用）を必ず保存すること */
export async function sendServiceMessage(input: { templateName: string; params: Record<string, string>; notificationToken: string }): Promise<NotifierToken> {
  const token = await channelAccessToken();
  const res = await safeFetch(`${API}/message/v3/notifier/send?target=service`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new ServiceMessageError(errorCategoryForStatus(res.status), res.status);
  return parseNotifierToken(await res.json().catch(() => null));
}

function parseNotifierToken(data: unknown): NotifierToken {
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    notificationToken: typeof d.notificationToken === "string" && d.notificationToken ? d.notificationToken : null,
    expiresIn: typeof d.expiresIn === "number" ? d.expiresIn : 0,
    remainingCount: typeof d.remainingCount === "number" ? d.remainingCount : 0,
    sessionId: typeof d.sessionId === "string" ? d.sessionId : null,
  };
}

async function safeFetch(url: string, init: RequestInit) {
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new ServiceMessageError("network_error");
  }
}
