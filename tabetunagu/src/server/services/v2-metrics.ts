import "server-only";
import { AppError } from "@/lib/errors";
import { BREAK_EVEN_GMV } from "@/lib/fees";
import { ymd } from "@/lib/format";
import { jstMonthRange } from "@/lib/time";
import { asService, asUser } from "../db";

/**
 * v2（事前決済の注文）の売上・KPI。
 *
 * 売上の基準（v2）
 * - 決済済みの注文を、決済日時（paid_at）で計上する。状態が paid / picked_up / unclaimed のもの。
 *   受取完了（picked_up）だけを売上にはしない。未受取（unclaimed）も決済済みなので売上に含める。
 * - 返金済み（refunded）・決済待ち（pending_payment）・キャンセル（cancelled）は含めない。
 * - 店舗の売上 = 商品小計（subtotal）。つなぐチャージは TABETUNAGU の売上で、店舗の売上ではない。
 * - 店舗受取額 = 小計 − 成約手数料（決済時点の手数料率で計算済みの commission_amount）。
 * 旧フロー（reservations）と v2（orders）は別のテーブルで、同じ取引が両方に入ることはないため二重計上しない。
 */
export const SALES_STATUSES = `('paid', 'picked_up', 'unclaimed')`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jstDay(now: Date) {
  const start = new Date(`${ymd(now)}T00:00:00+09:00`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export type StoreOrderSales = {
  today: { sales: number; orders: number };
  month: {
    sales: number;
    orders: number;
    commission: number;
    storeNet: number;
    pickedUp: number;
    unclaimed: number;
    awaitingPickup: number;
    refunded: number;
    refundedAmount: number;
  };
};

/** 店舗の v2 売上（店舗メンバーのみ。RLS で自店舗の注文だけが見える） */
export async function getStoreOrderSales(userId: string, storeId: string, monthParam?: string, now = new Date()): Promise<StoreOrderSales> {
  if (!UUID_RE.test(storeId)) throw new AppError("forbidden");
  const month = jstMonthRange(monthParam);
  const day = jstDay(now);
  return asUser(userId, async (q) => {
    const [member] = await q.query<{ ok: boolean }>("select public.is_store_member($1::uuid) as ok", [storeId]);
    if (!member?.ok) throw new AppError("forbidden");
    const [r] = await q.query<Record<string, number>>(
      `select
         coalesce(sum(subtotal) filter (where status in ${SALES_STATUSES} and paid_at >= $4 and paid_at < $5), 0)::int as today_sales,
         count(*) filter (where status in ${SALES_STATUSES} and paid_at >= $4 and paid_at < $5)::int as today_orders,
         coalesce(sum(subtotal) filter (where status in ${SALES_STATUSES} and paid_at >= $2 and paid_at < $3), 0)::int as month_sales,
         count(*) filter (where status in ${SALES_STATUSES} and paid_at >= $2 and paid_at < $3)::int as month_orders,
         coalesce(sum(commission_amount) filter (where status in ${SALES_STATUSES} and paid_at >= $2 and paid_at < $3), 0)::int as month_commission,
         count(*) filter (where status = 'picked_up' and paid_at >= $2 and paid_at < $3)::int as picked_up,
         count(*) filter (where status = 'unclaimed' and paid_at >= $2 and paid_at < $3)::int as unclaimed,
         count(*) filter (where status = 'paid' and paid_at >= $2 and paid_at < $3)::int as awaiting,
         count(*) filter (where status = 'refunded' and refunded_at >= $2 and refunded_at < $3)::int as refunded,
         coalesce(sum(subtotal) filter (where status = 'refunded' and refunded_at >= $2 and refunded_at < $3), 0)::int as refunded_amount
       from public.orders where store_id = $1`,
      [storeId, month.start.toISOString(), month.end.toISOString(), day.start.toISOString(), day.end.toISOString()],
    );
    return {
      today: { sales: r.today_sales, orders: r.today_orders },
      month: {
        sales: r.month_sales,
        orders: r.month_orders,
        commission: r.month_commission,
        storeNet: r.month_sales - r.month_commission,
        pickedUp: r.picked_up,
        unclaimed: r.unclaimed,
        awaitingPickup: r.awaiting,
        refunded: r.refunded,
        refundedAmount: r.refunded_amount,
      },
    };
  });
}

/**
 * 管理画面の v2 KPI（期間 from〜to）。
 *
 * PoC で追う指標の定義
 * 1. 食べつなぎ率 = 期間内に受取開始の出品の、売れた数量（v2 の決済済み注文 + 旧フローの成約）÷ 出品数量
 * 2. 30日リピート率（v2）= 初回の決済済み注文から30日以上経ったユーザーのうち、初回から30日以内に2回目の決済済み注文があった割合
 * 3. 店舗 WAU = 直近7日に受取開始の出品があった稼働店舗の数（店舗が「使っている」ことの代わりの指標）
 * 4. 自己スワイプ完了率 = 受取期限（受取終了 + 猶予）を過ぎた決済済み注文のうち、受取完了（picked_up）の割合
 *    = picked_up ÷（picked_up + unclaimed + 期限を過ぎたのにまだ paid のもの）。受取終了が期間内の注文で数える
 * 5. STANDARD 移行対象店舗 = FREE 店舗のうち、直近30日の v2 売上（小計）が損益分岐（BREAK_EVEN_GMV）以上
 */
export async function getV2Kpis(from: Date, to: Date, lateGraceMinutes: number) {
  const range = [from.toISOString(), to.toISOString()];
  return asService(async (q) => {
    const [k] = await q.query<Record<string, number>>(
      `select
         coalesce(sum(subtotal) filter (where status in ${SALES_STATUSES} and paid_at >= $1 and paid_at < $2), 0)::int as gmv,
         coalesce(sum(total) filter (where status in ${SALES_STATUSES} and paid_at >= $1 and paid_at < $2), 0)::int as charged,
         count(*) filter (where status in ${SALES_STATUSES} and paid_at >= $1 and paid_at < $2)::int as paid_orders,
         count(*) filter (where status = 'picked_up' and paid_at >= $1 and paid_at < $2)::int as picked_up,
         count(*) filter (where status = 'unclaimed' and paid_at >= $1 and paid_at < $2)::int as unclaimed,
         count(*) filter (where status = 'refunded' and refunded_at >= $1 and refunded_at < $2)::int as refunded,
         coalesce(sum(commission_amount) filter (where status in ${SALES_STATUSES} and paid_at >= $1 and paid_at < $2), 0)::int as commission,
         coalesce(sum(tsunagu_charge) filter (where status in ${SALES_STATUSES} and paid_at >= $1 and paid_at < $2), 0)::int as charge,
         -- 自己スワイプ完了率（受取期限が到来した注文のみ）
         count(*) filter (where status = 'picked_up' and pickup_end >= $1 and pickup_end < $2
                          and pickup_end + make_interval(mins => $3) < now())::int as swipe_done,
         count(*) filter (where status in ('picked_up', 'unclaimed', 'paid') and pickup_end >= $1 and pickup_end < $2
                          and pickup_end + make_interval(mins => $3) < now())::int as swipe_due,
         -- 定期処理の遅れ（Cron 未設定の検知用）: 期限を30分以上過ぎても処理されていない注文
         count(*) filter (where status = 'pending_payment' and payment_expires_at < now() - interval '30 minutes')::int as stale_pending,
         count(*) filter (where status = 'paid' and pickup_end + make_interval(mins => $3) < now() - interval '30 minutes')::int as stale_paid
       from public.orders`,
      [...range, lateGraceMinutes],
    );
    const [p] = await q.query<Record<string, number>>(
      `select
         coalesce(sum(amount) filter (where type = 'earned' and created_at >= $1 and created_at < $2), 0)::int as issued,
         coalesce(-sum(amount) filter (where type = 'revoked' and created_at >= $1 and created_at < $2), 0)::int as revoked,
         coalesce(sum(amount), 0)::int as outstanding
       from public.points_transactions`,
      range,
    );
    const [review] = await q.query<{ n: number }>("select count(*)::int as n from public.payments where status = 'requires_review'");
    const [sold] = await q.query<{ listed: number; v2: number; legacy: number }>(
      `select
         (select coalesce(sum(quantity), 0) from public.products where deleted_at is null and pickup_start_at >= $1 and pickup_start_at < $2)::int as listed,
         (select coalesce(sum(i.quantity), 0) from public.order_items i join public.orders o on o.id = i.order_id
            join public.products p on p.id = i.product_id
            where o.status in ${SALES_STATUSES} and p.pickup_start_at >= $1 and p.pickup_start_at < $2)::int as v2,
         (select coalesce(sum(r.quantity), 0) from public.reservations r
            where r.status = 'completed' and r.pickup_start_at >= $1 and r.pickup_start_at < $2)::int as legacy`,
      range,
    );
    const [repeat] = await q.query<{ cohort: number; repeated: number }>(
      `with firsts as (
         select user_id, min(paid_at) as first_at from public.orders where status in ${SALES_STATUSES} group by user_id
       )
       select count(*)::int as cohort,
              count(*) filter (where exists (
                select 1 from public.orders o
                where o.user_id = f.user_id and o.status in ${SALES_STATUSES}
                  and o.paid_at > f.first_at and o.paid_at <= f.first_at + interval '30 days'
              ))::int as repeated
       from firsts f where f.first_at <= now() - interval '30 days'`,
    );
    const [wau] = await q.query<{ n: number }>(
      `select count(distinct p.store_id)::int as n from public.products p join public.stores s on s.id = p.store_id
       where s.status = 'active' and p.deleted_at is null and p.pickup_start_at >= now() - interval '7 days' and p.pickup_start_at < now()`,
    );
    const upgrade = await q.query<{ id: string; name: string; sales: number }>(
      `select s.id, s.name, coalesce(sum(o.subtotal), 0)::int as sales
       from public.stores s join public.orders o on o.store_id = s.id
       where s.plan_code = 'free' and s.status = 'active' and o.status in ${SALES_STATUSES} and o.paid_at >= now() - interval '30 days'
       group by s.id, s.name
       having coalesce(sum(o.subtotal), 0) >= $1
       order by sales desc`,
      [BREAK_EVEN_GMV],
    );
    const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
    return {
      gmv: k.gmv,
      charged: k.charged,
      paidOrders: k.paid_orders,
      pickedUp: k.picked_up,
      unclaimed: k.unclaimed,
      refunded: k.refunded,
      commission: k.commission,
      tsunaguCharge: k.charge,
      platformRevenue: k.commission + k.charge,
      points: { issued: p.issued, revoked: p.revoked, outstanding: p.outstanding },
      requiresReview: review?.n ?? 0,
      maintenanceBacklog: k.stale_pending + k.stale_paid,
      poc: {
        tsunagiRate: ratio(sold.v2 + sold.legacy, sold.listed),
        repeatRate: ratio(repeat?.repeated ?? 0, repeat?.cohort ?? 0),
        repeatCohort: repeat?.cohort ?? 0,
        storeWau: wau?.n ?? 0,
        swipeRate: ratio(k.swipe_done, k.swipe_due),
        swipeDue: k.swipe_due,
        upgradeCandidates: upgrade,
      },
    };
  });
}
