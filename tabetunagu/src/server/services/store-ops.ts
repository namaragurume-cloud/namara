import "server-only";
import { AppError } from "@/lib/errors";
import { ORDER_POLICY } from "@/lib/orders";
import { salesRange, type SalesPeriod } from "@/lib/store-dashboard";
import { jstMonthRange } from "@/lib/time";
import { asUser } from "../db";
import { SALES_STATUSES } from "./v2-metrics";

/**
 * 店舗ダッシュボード・売上画面の集計（v2 の事前決済の注文）。店舗メンバーのみ（RLS で自店舗の行だけが見える）。
 * 1回の接続で、注文の集計1クエリ + 商品の集計1クエリだけを実行する（商品・注文ごとに問い合わせない）。
 *
 * 売上の定義（既存の getStoreOrderSales と同じ）: 決済済み（paid / picked_up / unclaimed）を決済日時で計上。
 * 返金済み・決済待ち・キャンセルは含めない。店舗受取見込 = 売上 − 成約手数料。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86_400_000;

export type StoreOps = {
  today: { sales: number; orders: number };
  month: { sales: number; orders: number; commission: number };
  period: {
    sales: number;
    orders: number;
    commission: number;
    storeNet: number;
    pickedUp: number;
    unclaimed: number;
    refunded: number;
    refundedAmount: number;
  };
  /** これから受取（決済済みで、受取期限（受取終了 + 猶予）前） */
  upcomingPickups: number;
  /** 昨日（JST）が受取終了だった未受取 */
  unclaimedYesterday: number;
  products: { total: number; live: number };
};

export async function getStoreOps(userId: string, storeId: string, period: SalesPeriod = "month", now = new Date()): Promise<StoreOps> {
  if (!UUID_RE.test(storeId)) throw new AppError("forbidden");
  const range = salesRange(period, now);
  const today = salesRange("today", now);
  const month = jstMonthRange(new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 7));
  const yesterday = { start: new Date(today.start.getTime() - DAY), end: today.start };
  return asUser(userId, async (q) => {
    const [member] = await q.query<{ ok: boolean }>("select public.is_store_member($1::uuid) as ok", [storeId]);
    if (!member?.ok) throw new AppError("forbidden");
    const [o] = await q.query<Record<string, number>>(
      `select
         coalesce(sum(subtotal) filter (where status in ${SALES_STATUSES} and paid_at >= $2 and paid_at < $3), 0)::int as p_sales,
         count(*) filter (where status in ${SALES_STATUSES} and paid_at >= $2 and paid_at < $3)::int as p_orders,
         coalesce(sum(commission_amount) filter (where status in ${SALES_STATUSES} and paid_at >= $2 and paid_at < $3), 0)::int as p_commission,
         count(*) filter (where status = 'picked_up' and paid_at >= $2 and paid_at < $3)::int as p_picked_up,
         count(*) filter (where status = 'unclaimed' and paid_at >= $2 and paid_at < $3)::int as p_unclaimed,
         count(*) filter (where status = 'refunded' and refunded_at >= $2 and refunded_at < $3)::int as p_refunded,
         coalesce(sum(subtotal) filter (where status = 'refunded' and refunded_at >= $2 and refunded_at < $3), 0)::int as p_refunded_amount,
         coalesce(sum(subtotal) filter (where status in ${SALES_STATUSES} and paid_at >= $4 and paid_at < $5), 0)::int as t_sales,
         count(*) filter (where status in ${SALES_STATUSES} and paid_at >= $4 and paid_at < $5)::int as t_orders,
         coalesce(sum(subtotal) filter (where status in ${SALES_STATUSES} and paid_at >= $6 and paid_at < $7), 0)::int as m_sales,
         count(*) filter (where status in ${SALES_STATUSES} and paid_at >= $6 and paid_at < $7)::int as m_orders,
         coalesce(sum(commission_amount) filter (where status in ${SALES_STATUSES} and paid_at >= $6 and paid_at < $7), 0)::int as m_commission,
         count(*) filter (where status = 'paid' and pickup_end + make_interval(mins => $9) > $8::timestamptz)::int as upcoming,
         count(*) filter (where status = 'unclaimed' and pickup_end >= $10 and pickup_end < $11)::int as unclaimed_yesterday
       from public.orders where store_id = $1`,
      [
        storeId,
        range.start.toISOString(),
        range.end.toISOString(),
        today.start.toISOString(),
        today.end.toISOString(),
        month.start.toISOString(),
        month.end.toISOString(),
        now.toISOString(),
        ORDER_POLICY.pickupLateGraceMinutes,
        yesterday.start.toISOString(),
        yesterday.end.toISOString(),
      ],
    );
    const [p] = await q.query<{ total: number; live: number }>(
      `select count(*)::int as total,
              count(*) filter (where status = 'published' and pickup_end_at > $2::timestamptz)::int as live
       from public.products where store_id = $1 and deleted_at is null`,
      [storeId, now.toISOString()],
    );
    return {
      today: { sales: o.t_sales, orders: o.t_orders },
      month: { sales: o.m_sales, orders: o.m_orders, commission: o.m_commission },
      period: {
        sales: o.p_sales,
        orders: o.p_orders,
        commission: o.p_commission,
        storeNet: Math.max(0, o.p_sales - o.p_commission),
        pickedUp: o.p_picked_up,
        unclaimed: o.p_unclaimed,
        refunded: o.p_refunded,
        refundedAmount: o.p_refunded_amount,
      },
      upcomingPickups: o.upcoming,
      unclaimedYesterday: o.unclaimed_yesterday,
      products: { total: p?.total ?? 0, live: p?.live ?? 0 },
    };
  });
}
