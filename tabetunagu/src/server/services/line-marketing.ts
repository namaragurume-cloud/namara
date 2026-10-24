import "server-only";
import { randomUUID } from "node:crypto";
import { featuredCard, featuredFlexMessage, type FeaturedProduct } from "@/lib/featured-message";
import { asService } from "../db";
import { env } from "../env";

/**
 * 「今日の食べつなぎ」（注目商品）を LINE 公式アカウントの Messaging API（Push）で送るデモ。
 * - 送信先はログイン中の管理者本人だけ（Broadcast・Multicast はしない）。本番では無効
 * - LINE の userId は LINE Login で保存した users.line_user_id（同じプロバイダーのチャネル間でだけ一致する）
 * - チャネルアクセストークンは環境変数（LINE_CHANNEL_ACCESS_TOKEN）だけ。DB・ログ・画面には出さない
 * - 毎日の自動配信（Cron）は有効にしていない
 */

export type MarketingErrorCategory =
  | "not_enabled"
  | "not_configured"
  | "not_line_user"
  | "product_not_found"
  | "duplicate"
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "line_unavailable"
  | "network_error";

export type MarketingResult = { ok: true } | { ok: false; category: MarketingErrorCategory };

/** 同じ人への連続送信（どの商品でも）を止める間隔と、同じ商品を同じ人へ送り直せるまでの間隔 */
export const PUSH_DEMO_INTERVAL_MS = 60_000;
export const PUSH_DEMO_SAME_PRODUCT_INTERVAL_MS = 10 * 60_000;

/** デモで選べる商品（公開中・受取終了前） */
export async function listFeaturableProducts(limit = 50) {
  const rows = await asService((q) =>
    q.query<{ id: string; name: string; store_name: string }>(
      `select p.id, p.name, s.name as store_name from public.products p join public.stores s on s.id = p.store_id
       where p.status = 'published' and p.deleted_at is null and p.pickup_end_at > now() and s.status = 'active'
       order by p.pickup_start_at, p.name limit $1`,
      [limit],
    ),
  );
  return rows.map((r) => ({ id: r.id, label: `${r.store_name}｜${r.name}` }));
}

export async function getFeaturedProduct(productId: string): Promise<FeaturedProduct | null> {
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return null;
  const [r] = await asService((q) =>
    q.query<Record<string, unknown>>(
      `select p.id, p.name, p.image_url, p.original_price, p.rescue_price, p.remaining_quantity, p.is_box,
              p.pickup_start_at, p.pickup_end_at, s.name as store_name
       from public.products p join public.stores s on s.id = p.store_id
       where p.id = $1 and p.status = 'published' and p.deleted_at is null and p.pickup_end_at > now() and s.status = 'active'`,
      [productId],
    ),
  );
  if (!r) return null;
  return {
    id: String(r.id),
    name: String(r.name),
    storeName: String(r.store_name),
    imageUrl: (r.image_url as string | null) ?? null,
    originalPrice: Number(r.original_price),
    rescuePrice: Number(r.rescue_price),
    remaining: Number(r.remaining_quantity),
    isBox: Boolean(r.is_box),
    pickupStartAt: new Date(r.pickup_start_at as string).toISOString(),
    pickupEndAt: new Date(r.pickup_end_at as string).toISOString(),
  };
}

async function log(targetUserId: string, productId: string | null, status: "sent" | "failed" | "skipped", category: string | null) {
  await asService((q) =>
    q.query(
      `insert into public.line_push_message_logs (notification_type, product_id, target_user_id, status, error_category, sent_at)
       values ('featured_product_demo', $1, $2, $3, $4, case when $3 = 'sent' then now() else null end)`,
      [productId, targetUserId, status, category],
    ),
  ).catch((e) => console.error("[line-push] log failed", e instanceof Error ? e.message : "unknown"));
}

function categoryForStatus(status: number): MarketingErrorCategory {
  if (status === 400) return "bad_request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  return "line_unavailable";
}

/**
 * 管理者本人に「今日の食べつなぎ」を1件送る（呼び出し側で管理者であることを確認すること）。
 */
export async function sendFeaturedProductDemo(adminUserId: string, productId: string, now = new Date()): Promise<MarketingResult> {
  if (!env.line.marketingDemoEnabled) return { ok: false, category: "not_enabled" };
  const accessToken = env.line.messagingAccessToken;
  if (!accessToken) return { ok: false, category: "not_configured" };

  const product = await getFeaturedProduct(productId);
  if (!product) return { ok: false, category: "product_not_found" };

  const [u] = await asService((q) =>
    q.query<{ line_user_id: string | null; recent_any: boolean; recent_same: boolean }>(
      `select u.line_user_id,
              exists (select 1 from public.line_push_message_logs l where l.target_user_id = u.id and l.status = 'sent'
                        and l.sent_at > $2::timestamptz - make_interval(secs => $3)) as recent_any,
              exists (select 1 from public.line_push_message_logs l where l.target_user_id = u.id and l.status = 'sent'
                        and l.product_id = $4 and l.sent_at > $2::timestamptz - make_interval(secs => $5)) as recent_same
       from public.users u where u.id = $1`,
      [adminUserId, now.toISOString(), PUSH_DEMO_INTERVAL_MS / 1000, productId, PUSH_DEMO_SAME_PRODUCT_INTERVAL_MS / 1000],
    ),
  );
  if (!u?.line_user_id || !/^U[0-9a-f]{32}$/.test(u.line_user_id)) {
    await log(adminUserId, productId, "failed", "not_line_user");
    return { ok: false, category: "not_line_user" };
  }
  if (u.recent_any || u.recent_same) {
    await log(adminUserId, productId, "skipped", "duplicate");
    return { ok: false, category: "duplicate" };
  }

  const card = featuredCard(product, { liffId: env.line.liffId, appUrl: env.appUrl, now });
  let res: Response;
  try {
    res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
        // 通信の再試行で二重に届かないようにする（LINE 側で同じキーの再送を1回として扱う）
        "x-line-retry-key": randomUUID(),
      },
      body: JSON.stringify({ to: u.line_user_id, messages: [featuredFlexMessage(card)] }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    console.error("[line-push] demo send failed", "network_error");
    await log(adminUserId, productId, "failed", "network_error");
    return { ok: false, category: "network_error" };
  }
  if (!res.ok) {
    const category = categoryForStatus(res.status);
    // 本文には個人情報・トークンは含まれないが、念のため LINE のメッセージ本文はログに出さない（状態コードと分類だけ）
    console.error("[line-push] demo send failed", category, res.status);
    await log(adminUserId, productId, "failed", category);
    return { ok: false, category };
  }
  await log(adminUserId, productId, "sent", null);
  return { ok: true };
}

/** 直近の送信記録（LINE の userId は返さない） */
export async function recentPushLogs(adminUserId: string, limit = 5) {
  return asService((q) =>
    q.query<{ status: string; error_category: string | null; created_at: Date; product_name: string | null }>(
      `select l.status, l.error_category, l.created_at, p.name as product_name
       from public.line_push_message_logs l left join public.products p on p.id = l.product_id
       where l.target_user_id = $1 order by l.created_at desc limit $2`,
      [adminUserId, limit],
    ),
  );
}
