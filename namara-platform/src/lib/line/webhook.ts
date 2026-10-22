/**
 * LINE Messaging API の Webhook 処理（なまらAI＝消費者向けチャネル専用）。
 *
 * - 署名検証は route.ts で生ボディに対して行い、通ったものだけここに渡す
 * - webhookEventId で重複処理を防ぐ（LINE の再送に対応）
 * - LINE の userId は HMAC 化してから扱い、生の値は保存・ログ出力しない
 * - 店舗向け通知（NAMARA REVIEW）はこのチャネルを使わない（別チャネル・別トークン）
 */
import { z } from "zod";
import { hashIdentifier } from "@/lib/security/identity";
import { limiter } from "@/lib/security/rate-limit";
import type { Db } from "@/lib/server/db";
import { runSearch } from "@/lib/server/services/search-service";
import { buildSearchReply, LINE_HELP_MESSAGE, LINE_RATE_LIMIT_MESSAGE, type LineMessage } from "./flex";

export interface LineClient {
  reply(replyToken: string, messages: LineMessage[]): Promise<void>;
}

/** 外部APIを呼ばずに送信内容を記録するだけのクライアント（Phase 1 の既定） */
export class MockLineClient implements LineClient {
  readonly sent: { replyToken: string; messages: LineMessage[] }[] = [];
  async reply(replyToken: string, messages: LineMessage[]) {
    this.sent.push({ replyToken, messages });
  }
}

/** 本番用クライアント。LINE_REPLY_ENABLED=1 とアクセストークンが揃ったときだけ使う */
export class HttpLineClient implements LineClient {
  constructor(private readonly accessToken: string) {}
  async reply(replyToken: string, messages: LineMessage[]) {
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.accessToken}` },
      body: JSON.stringify({ replyToken, messages: messages.slice(0, 5) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`LINE reply failed: HTTP ${res.status}`);
  }
}

const eventSchema = z.object({
  type: z.string(),
  webhookEventId: z.string().optional(),
  replyToken: z.string().optional(),
  deliveryContext: z.object({ isRedelivery: z.boolean() }).optional(),
  source: z.object({ type: z.string(), userId: z.string().optional() }).optional(),
  message: z.object({ type: z.string(), text: z.string().optional() }).optional(),
});

export const webhookBodySchema = z.object({ destination: z.string().optional(), events: z.array(z.unknown()) });

export type WebhookResult = { processed: number; skippedDuplicates: number; errors: number };

/** 1ユーザーあたり1分10回まで（1日の上限は Phase 7 で永続ストアと合わせて実装） */
const perMinute = () => limiter("line_user", 10, 60_000);

export async function processLineEvents(
  rawEvents: unknown[],
  deps: { db: Db; client: LineClient; baseUrl: string; now?: Date },
): Promise<WebhookResult> {
  const result: WebhookResult = { processed: 0, skippedDuplicates: 0, errors: 0 };

  for (const raw of rawEvents) {
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) {
      result.errors += 1;
      continue;
    }
    const event = parsed.data;
    if (event.webhookEventId) {
      if (deps.db.processedWebhookEvents.has(event.webhookEventId)) {
        result.skippedDuplicates += 1;
        continue;
      }
      deps.db.processedWebhookEvents.add(event.webhookEventId);
    }
    if (!event.replyToken) continue;

    const userId = event.source?.userId;
    const sessionId = userId ? `line:${hashIdentifier("line", userId).slice(0, 32)}` : "line:unknown";

    try {
      if (event.type === "follow") {
        await deps.client.reply(event.replyToken, [LINE_HELP_MESSAGE]);
      } else if (event.type === "message" && event.message?.type === "text" && event.message.text) {
        if (!perMinute().check(sessionId).allowed) {
          await deps.client.reply(event.replyToken, [LINE_RATE_LIMIT_MESSAGE]);
        } else {
          const outcome = runSearch({ text: event.message.text.slice(0, 200), sessionId, channel: "line" }, deps.db, deps.now);
          await deps.client.reply(event.replyToken, buildSearchReply(outcome, deps.baseUrl));
        }
      } else if (event.type === "message") {
        await deps.client.reply(event.replyToken, [LINE_HELP_MESSAGE]);
      }
      result.processed += 1;
    } catch (error) {
      result.errors += 1;
      // 個人を特定できる値（userId・本文）はログに出さない
      console.error("[line] event processing failed", { type: event.type, error: error instanceof Error ? error.message : "unknown" });
    }
  }
  return result;
}
