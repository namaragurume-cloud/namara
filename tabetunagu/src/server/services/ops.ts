import "server-only";
import { v2Readiness, type V2Readiness } from "@/lib/features";
import { asService } from "../db";
import { env } from "../env";

/**
 * PoC 公開準備・運用監視（管理画面用）。秘密情報の値は返さない（設定の有無だけ）。
 */

/** 定期処理（/api/cron/orders）の監視キー */
export const ORDER_MAINTENANCE_KEY = "order_maintenance";
/** これより長く定期処理の成功がなければ警告（5分ごとの実行を想定） */
export const CRON_STALE_MINUTES = 15;

export async function recordHeartbeat(key: string, result: Record<string, unknown> = {}) {
  await asService((q) => q.query("select public.record_heartbeat($1, $2::jsonb)", [key, JSON.stringify(result)]));
}

export type CronStatus = { lastSuccessAt: string | null; minutesAgo: number | null; state: "ok" | "stale" | "never" };

export function cronState(lastSuccessAt: Date | null, now = new Date()): CronStatus {
  if (!lastSuccessAt) return { lastSuccessAt: null, minutesAgo: null, state: "never" };
  const minutesAgo = Math.max(0, Math.floor((now.getTime() - lastSuccessAt.getTime()) / 60_000));
  return { lastSuccessAt: lastSuccessAt.toISOString(), minutesAgo, state: minutesAgo >= CRON_STALE_MINUTES ? "stale" : "ok" };
}

export type OpsReadiness = {
  flag: V2Readiness;
  stripe: { secretKey: boolean; webhookSecret: boolean; checkoutReturnUrl: boolean };
  cronSecret: boolean;
  cron: CronStatus;
  storesActive: number;
  storesConnectPending: number;
  requiresReview: number;
  refundsFailed: number;
};

export async function getOpsReadiness(now = new Date()): Promise<OpsReadiness> {
  const flag = v2Readiness();
  const [row] = await asService((q) =>
    q.query<{ last_success_at: Date | null; stores_active: number; connect_pending: number; review: number; refunds_failed: number }>(
      `select
         (select last_success_at from public.ops_heartbeats where key = $1) as last_success_at,
         (select count(*) from public.stores where status = 'active')::int as stores_active,
         (select count(*) from public.stores where status = 'active' and not stripe_charges_enabled)::int as connect_pending,
         (select count(*) from public.payments where status = 'requires_review')::int as review,
         (select count(*) from public.refunds where status = 'failed')::int as refunds_failed`,
      [ORDER_MAINTENANCE_KEY],
    ),
  );
  return {
    flag,
    stripe: {
      secretKey: !flag.missing.includes("STRIPE_SECRET_KEY"),
      webhookSecret: !flag.missing.includes("STRIPE_WEBHOOK_SECRET"),
      checkoutReturnUrl: !flag.missing.includes("STRIPE_CHECKOUT_RETURN_URL"),
    },
    cronSecret: Boolean(env.cronSecret),
    cron: cronState(row?.last_success_at ? new Date(row.last_success_at) : null, now),
    storesActive: row?.stores_active ?? 0,
    storesConnectPending: row?.connect_pending ?? 0,
    requiresReview: row?.review ?? 0,
    refundsFailed: row?.refunds_failed ?? 0,
  };
}

// ---------------------------------------------------------------------------
// 要確認の決済・未受取の一覧（管理者のみ。呼び出し側で requireAdmin）
// ---------------------------------------------------------------------------

export type ReviewRow = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  storeName: string;
  amount: number;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  orderStatus: string;
};

/** 金額などが一致しない決済・返金に失敗した決済（requires_review） */
export async function listRequiresReview(limit = 200): Promise<ReviewRow[]> {
  const rows = await asService((q) =>
    q.query<Record<string, unknown>>(
      `select p.id as payment_id, o.id as order_id, o.order_number, s.name as store_name, p.amount, p.failure_reason,
              p.created_at, p.updated_at, o.status::text as order_status
       from public.payments p join public.orders o on o.id = p.order_id join public.stores s on s.id = o.store_id
       where p.status = 'requires_review'
       order by p.updated_at desc limit $1`,
      [limit],
    ),
  );
  return rows.map((r) => ({
    paymentId: String(r.payment_id),
    orderId: String(r.order_id),
    orderNumber: String(r.order_number),
    storeName: String(r.store_name),
    amount: Number(r.amount),
    failureReason: (r.failure_reason as string | null) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
    orderStatus: String(r.order_status),
  }));
}

export type UnclaimedRow = {
  orderId: string;
  orderNumber: string;
  storeName: string;
  items: string;
  amount: number;
  pickupEnd: string;
  unclaimedAt: string;
};

/** 直近の未受取（店舗・時間帯の傾向を見るため。お客様の情報は含めない） */
export async function listRecentUnclaimed(days = 30, limit = 300): Promise<UnclaimedRow[]> {
  const rows = await asService((q) =>
    q.query<Record<string, unknown>>(
      `select o.id, o.order_number, s.name as store_name, o.subtotal, o.pickup_end, o.unclaimed_at,
              (select string_agg(i.product_name_snapshot || ' ×' || i.quantity, '・' order by i.created_at)
                 from public.order_items i where i.order_id = o.id) as items
       from public.orders o join public.stores s on s.id = o.store_id
       where o.status = 'unclaimed' and o.unclaimed_at >= now() - make_interval(days => $1)
       order by o.unclaimed_at desc limit $2`,
      [days, limit],
    ),
  );
  return rows.map((r) => ({
    orderId: String(r.id),
    orderNumber: String(r.order_number),
    storeName: String(r.store_name),
    items: String(r.items ?? ""),
    amount: Number(r.subtotal),
    pickupEnd: new Date(r.pickup_end as string).toISOString(),
    unclaimedAt: new Date(r.unclaimed_at as string).toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// PoC 結果の CSV（個人情報は含めない: ユーザー ID・表示名・IP などは出さない）
// ---------------------------------------------------------------------------

function csvCell(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  // 表計算ソフトでの数式実行を防ぐ（= + - @ で始まる値は先頭に ' を付ける）
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: unknown[][]) {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export async function exportOrdersCsv(from: Date, to: Date) {
  const rows = await asService((q) =>
    q.query<Record<string, unknown>>(
      `select o.order_number, s.name as store_name, s.plan_code, o.status::text as status, o.subtotal, o.tsunagu_charge, o.total,
              o.commission_amount, o.platform_fee_total, o.pickup_start, o.pickup_end, o.paid_at, o.picked_up_at,
              o.unclaimed_at, o.refunded_at, o.cancelled_at, o.created_at
       from public.orders o join public.stores s on s.id = o.store_id
       where o.created_at >= $1 and o.created_at < $2
       order by o.created_at`,
      [from.toISOString(), to.toISOString()],
    ),
  );
  const header = [
    "order_number", "store", "plan", "status", "subtotal", "tsunagu_charge", "total", "commission", "platform_fee",
    "pickup_start", "pickup_end", "paid_at", "picked_up_at", "unclaimed_at", "refunded_at", "cancelled_at", "created_at",
  ];
  return toCsv(
    header,
    rows.map((r) => [
      r.order_number, r.store_name, r.plan_code, r.status, r.subtotal, r.tsunagu_charge, r.total, r.commission_amount,
      r.platform_fee_total, r.pickup_start, r.pickup_end, r.paid_at, r.picked_up_at, r.unclaimed_at, r.refunded_at,
      r.cancelled_at, r.created_at,
    ]),
  );
}

export async function exportStoresCsv(from: Date, to: Date) {
  const rows = await asService((q) =>
    q.query<Record<string, unknown>>(
      `select s.name, s.slug, s.area_id, s.plan_code, s.status::text as status, s.stripe_charges_enabled,
              count(o.id) filter (where o.status in ('paid', 'picked_up', 'unclaimed') and o.paid_at >= $1 and o.paid_at < $2)::int as paid_orders,
              coalesce(sum(o.subtotal) filter (where o.status in ('paid', 'picked_up', 'unclaimed') and o.paid_at >= $1 and o.paid_at < $2), 0)::int as gmv,
              count(o.id) filter (where o.status = 'picked_up' and o.paid_at >= $1 and o.paid_at < $2)::int as picked_up,
              count(o.id) filter (where o.status = 'unclaimed' and o.paid_at >= $1 and o.paid_at < $2)::int as unclaimed,
              count(o.id) filter (where o.status = 'refunded' and o.refunded_at >= $1 and o.refunded_at < $2)::int as refunded,
              coalesce(sum(o.platform_fee_total) filter (where o.status in ('paid', 'picked_up', 'unclaimed') and o.paid_at >= $1 and o.paid_at < $2), 0)::int as platform_fee
       from public.stores s left join public.orders o on o.store_id = s.id
       group by s.id order by s.name`,
      [from.toISOString(), to.toISOString()],
    ),
  );
  const header = ["store", "slug", "area", "plan", "status", "stripe_ready", "paid_orders", "gmv", "picked_up", "unclaimed", "refunded", "platform_fee"];
  return toCsv(
    header,
    rows.map((r) => [r.name, r.slug, r.area_id, r.plan_code, r.status, r.stripe_charges_enabled, r.paid_orders, r.gmv, r.picked_up, r.unclaimed, r.refunded, r.platform_fee]),
  );
}
