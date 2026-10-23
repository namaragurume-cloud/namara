import "server-only";
import { BREAK_EVEN_GMV } from "@/lib/fees";
import { ORDER_POLICY } from "@/lib/orders";
import {
  buildAlerts,
  cronHealth,
  dashboardRange,
  flagView,
  goNoGoSummary,
  isHighUnclaimed,
  pocKpis,
  pocStatus,
  standardCandidates,
  unclaimedRate,
  type DashboardPeriod,
} from "@/lib/poc-dashboard";
import type { StoreLaunchStatus } from "@/lib/readiness";
import { asService } from "../db";
import { CRON_STALE_MINUTES, getOpsReadiness } from "./ops";
import { getStoreReadiness } from "./readiness";
import { getV2Kpis, SALES_STATUSES } from "./v2-metrics";

/**
 * 管理ダッシュボード（PoC 運営の判断用）の集計。管理者のみ（呼び出し側で requireAdmin）。
 * 既存の集計（getV2Kpis・getOpsReadiness・getStoreReadiness）を使い、店舗別の値は1本の集計クエリで取得する（店舗ごとに問い合わせない）。
 * 個人情報（ユーザー名・LINE ID・IP・User-Agent・Stripe の ID）は返さない。
 */

/** 店舗のヘルス（フォローが必要な理由）。既存データで判断できるものだけ */
export type StoreHealthIssue = "no_listing_7d" | "stripe_pending" | "high_unclaimed" | "no_orders" | "monitor_unused";

export const STORE_HEALTH_LABEL: Record<StoreHealthIssue, string> = {
  no_listing_7d: "7日以上出品なし",
  stripe_pending: "Stripe 未設定",
  high_unclaimed: "未受取率が高い",
  no_orders: "出品はあるが30日間注文なし",
  monitor_unused: "受取モニター未利用（30日）",
};

export type StoreHealthRow = {
  id: string;
  name: string;
  plan: string;
  sales30d: number;
  lastListingAt: string | null;
  unclaimedRate: number | null;
  issues: StoreHealthIssue[];
};

export async function getPocDashboard(period: DashboardPeriod, now = new Date()) {
  const range = dashboardRange(period, now);
  const [v2, ops, readiness, db] = await Promise.all([
    getV2Kpis(range.from, range.to, ORDER_POLICY.pickupLateGraceMinutes),
    getOpsReadiness(now),
    getStoreReadiness(),
    queryDashboard(range.from, range.to, now),
  ]);

  // 店舗のヘルス（稼働中の店舗だけ）
  const health: StoreHealthRow[] = db.stores
    .filter((s) => s.active)
    .map((s) => {
      const issues: StoreHealthIssue[] = [];
      if (!s.lastListingAt || now.getTime() - Date.parse(s.lastListingAt) > 7 * 86_400_000) issues.push("no_listing_7d");
      if (!s.stripeReady) issues.push("stripe_pending");
      if (isHighUnclaimed(s.pickedUp30d, s.unclaimed30d)) issues.push("high_unclaimed");
      if (s.listings30d > 0 && s.orders30d === 0) issues.push("no_orders");
      if (!s.monitorOpened30d && s.orders30d > 0) issues.push("monitor_unused");
      return {
        id: s.id,
        name: s.name,
        plan: s.plan,
        sales30d: s.sales30d,
        lastListingAt: s.lastListingAt,
        unclaimedRate: unclaimedRate(s.pickedUp30d, s.unclaimed30d),
        issues,
      };
    })
    .filter((s) => s.issues.length > 0)
    .sort((a, b) => b.issues.length - a.issues.length || a.name.localeCompare(b.name, "ja"));
  const highUnclaimedStores = health.filter((s) => s.issues.includes("high_unclaimed")).length;

  const candidates = standardCandidates(
    db.stores.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, plan: s.plan, sales: s.sales30d })),
    BREAK_EVEN_GMV,
  );
  const overBreakEven = candidates.filter((c) => c.over).length;

  const kpis = pocKpis({
    tsunagi: { sold: db.sold, listed: db.listed },
    repeat: { repeated: db.repeat.repeated, cohort: db.repeat.cohort },
    storeWau: { active7d: v2.poc.storeWau, activeStores: ops.storesActive },
    swipe: { done: db.swipeDone, due: db.swipeDue },
    standardCandidates: overBreakEven,
  });

  const flag = flagView(ops.flag);
  const cron = cronHealth(ops.cron, CRON_STALE_MINUTES);
  const alerts = buildAlerts({
    requiresReview: ops.requiresReview,
    refundsFailed: ops.refundsFailed,
    cron,
    maintenanceBacklog: v2.maintenanceBacklog,
    storesConnectPending: ops.storesConnectPending,
    highUnclaimedStores,
    flag,
  });

  const readinessCounts: Record<StoreLaunchStatus, number> = { 未設定: 0, 商品準備中: 0, Stripe設定待ち: 0, 公開準備OK: 0 };
  for (const r of readiness.values()) readinessCounts[r.status]++;

  return {
    period,
    range: { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
    status: pocStatus(alerts, flag),
    alerts,
    kpis,
    goNoGo: goNoGoSummary(kpis, alerts),
    sales: {
      gmv: v2.gmv,
      orders: v2.paidOrders,
      commission: v2.commission,
      tsunaguCharge: v2.tsunaguCharge,
      /** 実売上 = 成約手数料 + つなぐチャージ。STANDARD の月額は課金（Billing）が未実装のため含めない */
      platformRevenue: v2.platformRevenue,
      refunds: { count: v2.refunded, amount: db.refundAmount },
      unclaimed: { count: v2.unclaimed, amount: db.unclaimedAmount, rate: unclaimedRate(v2.pickedUp, v2.unclaimed), pickedUp: v2.pickedUp },
    },
    stores: {
      total: db.storeTotal,
      active: ops.storesActive,
      withLiveProducts: db.stores.filter((s) => s.active && s.liveProducts > 0).length,
      withProducts: db.stores.filter((s) => s.active && s.productsTotal > 0).length,
      stripeReady: db.stores.filter((s) => s.active && s.stripeReady).length,
      listedToday: db.listedToday,
      listed7d: v2.poc.storeWau,
      readiness: readinessCounts,
      health,
    },
    users: db.users,
    standard: { breakEven: BREAK_EVEN_GMV, candidates, overBreakEven },
    points: v2.points,
    risk: { requiresReview: ops.requiresReview, refundsFailed: ops.refundsFailed },
    tech: { cron, flag, stripe: ops.stripe, cronSecret: ops.cronSecret, storesConnectPending: ops.storesConnectPending },
    trend: db.trend,
  };
}

export type PocDashboard = Awaited<ReturnType<typeof getPocDashboard>>;

async function queryDashboard(from: Date, to: Date, now: Date) {
  const range = [from.toISOString(), to.toISOString()];
  const grace = ORDER_POLICY.pickupLateGraceMinutes;
  return asService(async (q) => {
    // 店舗別（1クエリ）。直近30日の売上は期間切替に関係なく固定（STANDARD 候補・ヘルスの判断用）
    const stores = await q.query<Record<string, unknown>>(
      `select s.id, s.name, s.plan_code, s.status = 'active' as active, s.stripe_charges_enabled as stripe_ready,
              coalesce(o.sales, 0)::int as sales30d, coalesce(o.orders, 0)::int as orders30d,
              coalesce(o.picked_up, 0)::int as picked_up30d, coalesce(o.unclaimed, 0)::int as unclaimed30d,
              coalesce(p.total, 0)::int as products_total, coalesce(p.live, 0)::int as live_products,
              coalesce(p.listings30d, 0)::int as listings30d, p.last_listing_at,
              exists (select 1 from public.events e where e.store_id = s.id and e.name = 'monitor_opened'
                        and e.created_at > $1::timestamptz - interval '30 days') as monitor_opened
       from public.stores s
       left join (
         select store_id,
                sum(subtotal) filter (where status in ${SALES_STATUSES}) as sales,
                count(*) filter (where status in ${SALES_STATUSES}) as orders,
                count(*) filter (where status = 'picked_up') as picked_up,
                count(*) filter (where status = 'unclaimed') as unclaimed
         from public.orders where paid_at >= $1::timestamptz - interval '30 days' and paid_at < $1::timestamptz
         group by store_id
       ) o on o.store_id = s.id
       left join (
         select store_id, count(*) as total,
                count(*) filter (where status = 'published' and pickup_end_at > $1::timestamptz) as live,
                count(*) filter (where pickup_start_at >= $1::timestamptz - interval '30 days' and pickup_start_at < $1::timestamptz) as listings30d,
                max(pickup_start_at) filter (where pickup_start_at <= $1::timestamptz) as last_listing_at
         from public.products where deleted_at is null group by store_id
       ) p on p.store_id = s.id
       order by s.name`,
      [now.toISOString()],
    );
    const [k] = await q.query<Record<string, number>>(
      `select
         (select count(*) from public.stores)::int as store_total,
         (select count(distinct p.store_id) from public.products p join public.stores s on s.id = p.store_id
            where s.status = 'active' and p.deleted_at is null
              and p.pickup_start_at >= date_trunc('day', $3::timestamptz at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo'
              and p.pickup_start_at < (date_trunc('day', $3::timestamptz at time zone 'Asia/Tokyo') + interval '1 day') at time zone 'Asia/Tokyo')::int as listed_today,
         (select coalesce(sum(quantity), 0) from public.products where deleted_at is null and pickup_start_at >= $1 and pickup_start_at < $2)::int as listed,
         ((select coalesce(sum(i.quantity), 0) from public.order_items i join public.orders o on o.id = i.order_id
             join public.products p on p.id = i.product_id
             where o.status in ${SALES_STATUSES} and p.pickup_start_at >= $1 and p.pickup_start_at < $2)
          + (select coalesce(sum(r.quantity), 0) from public.reservations r
             where r.status = 'completed' and r.pickup_start_at >= $1 and r.pickup_start_at < $2))::int as sold,
         (select count(*) from public.orders where status = 'picked_up' and pickup_end >= $1 and pickup_end < $2
            and pickup_end + make_interval(mins => $4) < $3::timestamptz)::int as swipe_done,
         (select count(*) from public.orders where status in ('picked_up', 'unclaimed', 'paid') and pickup_end >= $1 and pickup_end < $2
            and pickup_end + make_interval(mins => $4) < $3::timestamptz)::int as swipe_due,
         (select coalesce(sum(subtotal), 0) from public.orders where status = 'unclaimed' and paid_at >= $1 and paid_at < $2)::int as unclaimed_amount,
         (select coalesce(sum(amount), 0) from public.refunds where status = 'succeeded' and succeeded_at >= $1 and succeeded_at < $2)::int as refund_amount`,
      [...range, now.toISOString(), grace],
    );
    // 30日リピート（定義は getV2Kpis と同じ。期間切替の影響を受けない）
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
       from firsts f where f.first_at <= $1::timestamptz - interval '30 days'`,
      [now.toISOString()],
    );
    // ユーザー（期間内に購入した人数。初回 = 最初の購入が期間内、リピート = 期間内に購入し、期間末までに2回以上購入）
    const [u] = await q.query<{ buyers: number; first_time: number; repeat_buyers: number }>(
      `with sales as (
         select user_id, paid_at from public.orders where status in ${SALES_STATUSES}
       ), per_user as (
         select user_id, min(paid_at) as first_at,
                count(*) filter (where paid_at < $2) as orders_to_end,
                bool_or(paid_at >= $1 and paid_at < $2) as bought_in_range
         from sales group by user_id
       )
       select count(*) filter (where bought_in_range)::int as buyers,
              count(*) filter (where first_at >= $1 and first_at < $2)::int as first_time,
              count(*) filter (where bought_in_range and orders_to_end >= 2)::int as repeat_buyers
       from per_user`,
      range,
    );
    // 日別（JST）の GMV・決済済み注文・受取完了。PoC累計は最初の注文日から（最大90日）
    const trend = await q.query<{ day: string; gmv: number; orders: number; picked_up: number }>(
      `with bounds as (
         select greatest(
                  ($1::timestamptz at time zone 'Asia/Tokyo')::date,
                  -- PoC累計は最初の注文日から（今日・7日・30日は期間の初日から、0件の日も並べる）
                  case when $4 then coalesce((select min(paid_at) from public.orders where status in ${SALES_STATUSES}) at time zone 'Asia/Tokyo', $3::timestamptz at time zone 'Asia/Tokyo')::date
                       else ($1::timestamptz at time zone 'Asia/Tokyo')::date end,
                  (($3::timestamptz at time zone 'Asia/Tokyo')::date - 89)
                ) as start_day,
                (($2::timestamptz - interval '1 second') at time zone 'Asia/Tokyo')::date as end_day
       ), days as (
         select generate_series(b.start_day, greatest(b.start_day, b.end_day), interval '1 day')::date as d from bounds b
       ), daily as (
         select (paid_at at time zone 'Asia/Tokyo')::date as d, sum(subtotal) as gmv, count(*) as orders,
                count(*) filter (where status = 'picked_up') as picked_up
         from public.orders where status in ${SALES_STATUSES} and paid_at >= $1 and paid_at < $2
         group by 1
       )
       select to_char(days.d, 'MM/DD') as day, coalesce(daily.gmv, 0)::int as gmv, coalesce(daily.orders, 0)::int as orders,
              coalesce(daily.picked_up, 0)::int as picked_up
       from days left join daily on daily.d = days.d order by days.d`,
      [...range, now.toISOString(), from.getUTCFullYear() <= 2000],
    );
    const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
    return {
      stores: stores.map((s) => ({
        id: String(s.id),
        name: String(s.name),
        plan: String(s.plan_code),
        active: Boolean(s.active),
        stripeReady: Boolean(s.stripe_ready),
        sales30d: Number(s.sales30d),
        orders30d: Number(s.orders30d),
        pickedUp30d: Number(s.picked_up30d),
        unclaimed30d: Number(s.unclaimed30d),
        productsTotal: Number(s.products_total),
        liveProducts: Number(s.live_products),
        listings30d: Number(s.listings30d),
        lastListingAt: iso(s.last_listing_at),
        monitorOpened30d: Boolean(s.monitor_opened),
      })),
      storeTotal: k.store_total,
      listedToday: k.listed_today,
      listed: k.listed,
      sold: k.sold,
      swipeDone: k.swipe_done,
      swipeDue: k.swipe_due,
      unclaimedAmount: k.unclaimed_amount,
      refundAmount: k.refund_amount,
      repeat: { cohort: repeat?.cohort ?? 0, repeated: repeat?.repeated ?? 0 },
      users: { buyers: u?.buyers ?? 0, firstTime: u?.first_time ?? 0, repeatBuyers: u?.repeat_buyers ?? 0 },
      trend: trend.map((t) => ({ day: t.day, gmv: Number(t.gmv), orders: Number(t.orders), pickedUp: Number(t.picked_up) })),
    };
  });
}
