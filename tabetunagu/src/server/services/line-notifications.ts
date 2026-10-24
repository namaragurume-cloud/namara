import "server-only";
import { pickupLabel, yen } from "@/lib/format";
import {
  buildParams,
  DEMO_RESEND_INTERVAL_MS,
  isValidTemplateName,
  parseParamMapping,
  type OrderMessageValues,
  type ServiceMessageErrorCategory,
  type ServiceMessageType,
} from "@/lib/service-message";
import { asService } from "../db";
import { env } from "../env";
import { issueNotificationToken, sendServiceMessage, ServiceMessageError } from "../line/service-message";

/**
 * LINE ミニアプリのサービスメッセージ（デモ）。
 * - サービス通知トークンはサーバー（DB）だけに保存し、送信のたびに LINE から返る新しい値に更新する
 * - LIFF アクセストークン・channel access token は保存しない
 * - 今回はデモ（管理者が自分自身の LINE に「注文完了」を1件送る）だけ。決済成功時などの自動送信は有効にしていない
 *   （将来: order_completed / pickup_reminder / order_status_changed を、同じ送信関数で注文ごとに1回だけ送る）
 */

export type ServiceMessageResult = { ok: true } | { ok: false; category: ServiceMessageErrorCategory };

type TokenRow = { id: string; token: string; remaining_count: number; expires_at: Date | string };

/** 注文完了テンプレートの設定（テンプレート名・変数の対応）。不正なら null */
export function orderTemplateConfig() {
  const templateName = env.line.serviceMessageOrderTemplate;
  const mapping = parseParamMapping(env.line.serviceMessageOrderParams);
  if (!templateName || !isValidTemplateName(templateName) || !mapping) return null;
  return { templateName, mapping };
}

/** LIFF アクセストークンからサービス通知トークンを発行し、保存する（ユーザーの操作ごと） */
export async function registerNotificationToken(
  userId: string,
  liffAccessToken: string,
  purpose: "demo" | "order_completed",
  orderId: string | null = null,
  now = new Date(),
) {
  const t = await issueNotificationToken(liffAccessToken);
  if (!t.notificationToken) throw new ServiceMessageError("line_unavailable");
  await asService((q) =>
    q.query(
      `insert into public.line_service_notification_tokens (user_id, order_id, purpose, session_id, token, remaining_count, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, orderId, purpose, t.sessionId, t.notificationToken, t.remainingCount, new Date(now.getTime() + t.expiresIn * 1000).toISOString()],
    ),
  );
  return { remainingCount: t.remainingCount };
}

/** 送信に使えるトークン（期限内・残り回数あり）のうち最新のもの */
async function latestUsableToken(userId: string, purpose: "demo" | "order_completed", now: Date): Promise<TokenRow | null> {
  const [row] = await asService((q) =>
    q.query<TokenRow>(
      `select id, token, remaining_count, expires_at from public.line_service_notification_tokens
       where user_id = $1 and purpose = $2 and remaining_count > 0 and expires_at > $3
       order by created_at desc limit 1`,
      [userId, purpose, now.toISOString()],
    ),
  );
  return row ?? null;
}

async function log(userId: string, type: ServiceMessageType, orderId: string | null, status: "sent" | "failed" | "skipped", category: string | null) {
  await asService((q) =>
    q.query(
      `insert into public.line_service_message_logs (user_id, notification_type, order_id, status, error_category, sent_at)
       values ($1, $2, $3, $4, $5, case when $4 = 'sent' then now() else null end)`,
      [userId, type, orderId, status, category],
    ),
  ).catch((e) => console.error("[line-sm] log failed", e instanceof Error ? e.message : "unknown"));
}

/** デモ文面の値（自分の直近の注文。なければサンプルの値）。個人情報は含めない */
async function demoValues(userId: string, now: Date): Promise<OrderMessageValues> {
  const [o] = await asService((q) =>
    q.query<Record<string, unknown>>(
      `select o.id, o.order_number, o.total, o.pickup_start, o.pickup_end, s.name as store_name,
              (select string_agg(i.product_name_snapshot || ' ×' || i.quantity, '・' order by i.created_at)
                 from public.order_items i where i.order_id = o.id) as items
       from public.orders o join public.stores s on s.id = o.store_id
       where o.user_id = $1 and o.status in ('paid', 'picked_up') order by o.created_at desc limit 1`,
      [userId],
    ),
  );
  if (!o) {
    const start = new Date(now.getTime() + 60 * 60_000);
    return {
      storeName: "TABETUNAGU デモ店舗",
      items: "本日のケーキ 食べつなぎBOX ×1",
      pickup: pickupLabel(start, new Date(start.getTime() + 3 * 60 * 60_000), now),
      orderNumber: "DEMO",
      total: yen(1230),
      orderPath: "orders",
    };
  }
  return {
    storeName: String(o.store_name),
    items: String(o.items ?? ""),
    pickup: pickupLabel(new Date(o.pickup_start as string), new Date(o.pickup_end as string), now),
    orderNumber: String(o.order_number),
    total: yen(Number(o.total)),
    orderPath: `orders/${String(o.id)}`,
  };
}

/**
 * デモ送信: 呼び出したユーザー自身の LINE に「注文完了」を1件送る（呼び出し側で管理者・デモ有効を確認すること）。
 * liffAccessToken があれば、その操作でサービス通知トークンを新しく発行してから送る（なければ保存済みの最新のトークン）。
 */
export async function sendDemoOrderCompleted(userId: string, liffAccessToken: string | null, now = new Date()): Promise<ServiceMessageResult> {
  const type: ServiceMessageType = "demo_order_completed";
  if (!env.line.serviceMessageDemoEnabled) return { ok: false, category: "not_enabled" };
  const config = orderTemplateConfig();
  if (!config) return { ok: false, category: "not_configured" };

  const [user] = await asService((q) =>
    q.query<{ line: boolean; recent: boolean }>(
      `select u.line_user_id is not null as line,
              exists (select 1 from public.line_service_message_logs l
                      where l.user_id = u.id and l.notification_type = $2 and l.status = 'sent'
                        and l.sent_at > $3::timestamptz - make_interval(secs => $4)) as recent
       from public.users u where u.id = $1`,
      [userId, type, now.toISOString(), DEMO_RESEND_INTERVAL_MS / 1000],
    ),
  );
  if (!user?.line) return { ok: false, category: "not_line_user" };
  if (user.recent) {
    await log(userId, type, null, "skipped", "duplicate");
    return { ok: false, category: "duplicate" };
  }

  try {
    if (liffAccessToken) await registerNotificationToken(userId, liffAccessToken, "demo", null, now);
    const row = await latestUsableToken(userId, "demo", now);
    if (!row) {
      await log(userId, type, null, "failed", "no_token");
      return { ok: false, category: "no_token" };
    }
    const params = buildParams(config.mapping, await demoValues(userId, now));
    try {
      const renewed = await sendServiceMessage({ templateName: config.templateName, params, notificationToken: row.token });
      // 送信のたびに更新されたトークンへ置き換える（残り0・期限切れで新しい値が返らなければ使えないことにする）
      await asService((q) =>
        q.query(
          `update public.line_service_notification_tokens
           set token = coalesce($2, token), remaining_count = $3,
               expires_at = case when $2::text is null then expires_at else $4::timestamptz end
           where id = $1`,
          [
            row.id,
            renewed.notificationToken,
            renewed.notificationToken ? renewed.remainingCount : 0,
            new Date(now.getTime() + renewed.expiresIn * 1000).toISOString(),
          ],
        ),
      );
    } catch (error) {
      // 使えないトークン（期限切れ・回数切れ）は以後使わない
      if (error instanceof ServiceMessageError && error.category === "bad_request") {
        await asService((q) => q.query("update public.line_service_notification_tokens set remaining_count = 0 where id = $1", [row.id]));
      }
      throw error;
    }
    await log(userId, type, null, "sent", null);
    return { ok: true };
  } catch (error) {
    const category = error instanceof ServiceMessageError ? error.category : "line_unavailable";
    console.error("[line-sm] demo send failed", category);
    await log(userId, type, null, "failed", category);
    return { ok: false, category };
  }
}

/** 直近の送信記録（管理画面のデモ用。トークンは返さない） */
export async function recentServiceMessageLogs(userId: string, limit = 5) {
  return asService((q) =>
    q.query<{ notification_type: string; status: string; error_category: string | null; created_at: Date }>(
      `select notification_type, status, error_category, created_at from public.line_service_message_logs
       where user_id = $1 order by created_at desc limit $2`,
      [userId, limit],
    ),
  );
}
