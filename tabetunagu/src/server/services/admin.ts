import "server-only";
import { AppError } from "@/lib/errors";
import { calcMonthlyFeeFromCompletions, isPlanCode, PLANS, type PlanCode } from "@/lib/fees";
import { ymd } from "@/lib/format";
import { jstMonthRange } from "@/lib/time";
import { asService } from "../db";
import { refreshDemoListings } from "../db/seed";
import { isoOrNull, isoStr } from "./mappers";

/**
 * 管理者向けの集計・操作。呼び出し側（ページ / Server Action）で必ず requireAdmin / assertAdmin を通すこと。
 * 全店舗を横断するため service（RLS バイパス）で読む。
 */

export type Period = "month" | "30d" | "all";

/** 管理画面の一覧行（表示専用・列は SQL の別名どおり） */
export type AdminRow = Record<string, unknown> & { id: string };

export function periodRange(period: Period, now = new Date()) {
  if (period === "month") {
    const m = jstMonthRange(ymd(now).slice(0, 7));
    return { from: m.start, to: m.end, label: `${m.month}（今月）` };
  }
  if (period === "30d") return { from: new Date(now.getTime() - 30 * 86_400_000), to: now, label: "直近30日" };
  return { from: new Date("2000-01-01T00:00:00Z"), to: new Date(now.getTime() + 86_400_000), label: "全期間" };
}

const RESOLVED = `(r.status in ('completed', 'no_show') or (r.status in ('pending', 'confirmed') and r.pickup_end_at + interval '30 minutes' < now()))`;

/** QR完了率がこれ未満で、判定済み予約が一定数以上ある店舗を「要確認」とする */
export const SUSPICIOUS_QR_RATE = 0.5;
export const WARNING_QR_RATE = 0.7;
export const MIN_RESOLVED_FOR_FLAG = 10;

export function storeFlag(resolved: number, completed: number): "ok" | "warning" | "suspicious" | "insufficient" {
  if (resolved < MIN_RESOLVED_FOR_FLAG) return "insufficient";
  const rate = completed / resolved;
  if (rate < SUSPICIOUS_QR_RATE) return "suspicious";
  if (rate < WARNING_QR_RATE) return "warning";
  return "ok";
}

export async function getKpis(period: Period, now = new Date()) {
  const { from, to, label } = periodRange(period, now);
  const range = [from.toISOString(), to.toISOString()];
  return asService(async (q) => {
    const [k] = await q.query<Record<string, number>>(
      `select
         (select count(*) from public.stores)::int as stores_total,
         (select count(*) from public.stores where status = 'active')::int as stores_active,
         (select count(distinct p.store_id) from public.products p join public.stores s on s.id = p.store_id
            where s.status = 'active' and p.deleted_at is null
              and p.pickup_start_at >= $1 and p.pickup_start_at < $2)::int as stores_operating,
         (select count(*) from public.stores where plan_code = 'free' and status <> 'suspended')::int as free_stores,
         (select count(*) from public.stores where plan_code = 'standard' and status <> 'suspended')::int as standard_stores,
         (select count(*) from public.users)::int as users_total,
         (select count(*) from public.users where created_at >= $1 and created_at < $2)::int as users_new,
         (select count(*) from public.users where last_seen_at >= now() - interval '30 days')::int as mau,
         (select count(*) from public.products where deleted_at is null and pickup_start_at >= $1 and pickup_start_at < $2)::int as listings,
         (select coalesce(sum(quantity), 0) from public.products where deleted_at is null and pickup_start_at >= $1 and pickup_start_at < $2)::int as listed_qty,
         (select count(*) from public.reservations where created_at >= $1 and created_at < $2)::int as reservations,
         (select count(*) from public.reservations where status = 'cancelled' and created_at >= $1 and created_at < $2)::int as cancelled,
         (select count(*) from public.reservations where status = 'completed' and completed_at >= $1 and completed_at < $2)::int as completions,
         (select coalesce(sum(total_price), 0) from public.reservations where status = 'completed' and completed_at >= $1 and completed_at < $2)::int as gmv,
         (select coalesce(floor(sum(total_price * commission_rate)), 0) from public.reservations
            where status = 'completed' and completed_at >= $1 and completed_at < $2)::int as commission,
         (select coalesce(sum(r.quantity), 0) from public.reservations r
            where r.status = 'completed' and r.pickup_start_at >= $1 and r.pickup_start_at < $2)::int as completed_qty,
         (select count(*) from public.reservations r where ${RESOLVED} and r.pickup_start_at >= $1 and r.pickup_start_at < $2)::int as resolved,
         (select count(*) from public.reservations r where r.status = 'completed' and r.pickup_start_at >= $1 and r.pickup_start_at < $2)::int as resolved_completed,
         (select coalesce(sum(r.quantity * p.estimated_weight_g), 0) from public.reservations r join public.products p on p.id = r.product_id
            where r.status = 'completed' and r.completed_at >= $1 and r.completed_at < $2)::int as food_saved_g`,
      range,
    );
    const [repeat] = await q.query<{ cohort: number; repeated: number }>(
      `with firsts as (
         select user_id, min(completed_at) as first_at from public.reservations where status = 'completed' group by user_id
       ), cohort as (
         select user_id, first_at from firsts where first_at <= now() - interval '30 days'
       )
       select count(*)::int as cohort,
              count(*) filter (where exists (
                select 1 from public.reservations r
                where r.user_id = c.user_id and r.status = 'completed'
                  and r.completed_at > c.first_at and r.completed_at <= c.first_at + interval '30 days'
              ))::int as repeated
       from cohort c`,
    );
    const trend = await q.query<{ day: string; reservations: number; completions: number }>(
      `select to_char(d, 'MM/DD') as day,
              (select count(*) from public.reservations r
                where r.created_at >= d at time zone 'Asia/Tokyo'
                  and r.created_at < (d + interval '1 day') at time zone 'Asia/Tokyo')::int as reservations,
              (select count(*) from public.reservations r
                where r.status = 'completed' and r.completed_at >= d at time zone 'Asia/Tokyo'
                  and r.completed_at < (d + interval '1 day') at time zone 'Asia/Tokyo')::int as completions
       from generate_series(
         ((now() at time zone 'Asia/Tokyo')::date - 13)::timestamp,
         ((now() at time zone 'Asia/Tokyo')::date)::timestamp,
         interval '1 day'
       ) as d
       order by d`,
    );
    const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
    const resolvedNoShow = k.resolved - k.resolved_completed;
    return {
      label,
      stores: {
        total: k.stores_total,
        active: k.stores_active,
        operating: k.stores_operating,
        operatingRate: ratio(k.stores_operating, k.stores_active),
        free: k.free_stores,
        standard: k.standard_stores,
      },
      users: { total: k.users_total, new: k.users_new, mau: k.mau },
      listings: k.listings,
      listedQty: k.listed_qty,
      reservations: k.reservations,
      cancelled: k.cancelled,
      completions: k.completions,
      tsunagiRate: ratio(k.completed_qty, k.listed_qty),
      qrRate: ratio(k.resolved_completed, k.resolved),
      noShowRate: ratio(resolvedNoShow, k.resolved),
      noShow: resolvedNoShow,
      repeatRate: ratio(repeat?.repeated ?? 0, repeat?.cohort ?? 0),
      repeatCohort: repeat?.cohort ?? 0,
      gmv: k.gmv,
      commission: k.commission,
      monthlyFees: period === "all" ? null : k.standard_stores * PLANS.standard.monthlyFee,
      foodSavedG: k.food_saved_g,
      trend,
    };
  });
}

export type AdminStoreRow = {
  id: string;
  slug: string;
  name: string;
  areaId: string;
  status: string;
  plan: PlanCode;
  isDemo: boolean;
  listings: number;
  reservations: number;
  completed: number;
  cancelled: number;
  storeCancelled: number;
  resolved: number;
  noShow: number;
  gmv: number;
  commission: number;
  failedCheckins: number;
  qrRate: number | null;
  flag: ReturnType<typeof storeFlag>;
};

export async function listStoresWithMetrics(period: Period, now = new Date()): Promise<AdminStoreRow[]> {
  const { from, to } = periodRange(period, now);
  const rows = await asService((q) =>
    q.query(
      `select s.id, s.slug, s.name, s.area_id, s.status::text as status, s.plan_code, s.is_demo,
              count(r.id)::int as reservations,
              count(r.id) filter (where r.status = 'completed')::int as completed,
              count(r.id) filter (where r.status = 'cancelled')::int as cancelled,
              count(r.id) filter (where r.status = 'cancelled' and r.cancelled_by = 'store')::int as store_cancelled,
              count(r.id) filter (where ${RESOLVED})::int as resolved,
              count(r.id) filter (where ${RESOLVED} and r.status <> 'completed')::int as no_show,
              coalesce(sum(r.total_price) filter (where r.status = 'completed'), 0)::int as gmv,
              coalesce(floor(sum(r.total_price * r.commission_rate) filter (where r.status = 'completed')), 0)::int as commission,
              (select count(*) from public.products p where p.store_id = s.id and p.deleted_at is null
                 and p.pickup_start_at >= $1 and p.pickup_start_at < $2)::int as listings,
              (select count(*) from public.checkins c where c.store_id = s.id and c.result <> 'success'
                 and c.created_at >= $1 and c.created_at < $2)::int as failed_checkins
       from public.stores s
       left join public.reservations r on r.store_id = s.id and r.pickup_start_at >= $1 and r.pickup_start_at < $2
       group by s.id
       order by count(r.id) desc, s.name`,
      [from.toISOString(), to.toISOString()],
    ),
  );
  return rows.map((r) => {
    const resolved = Number(r.resolved);
    const completed = Number(r.completed);
    return {
      id: String(r.id),
      slug: String(r.slug),
      name: String(r.name),
      areaId: String(r.area_id),
      status: String(r.status),
      plan: isPlanCode(String(r.plan_code)) ? (r.plan_code as PlanCode) : "free",
      isDemo: Boolean(r.is_demo),
      listings: Number(r.listings),
      reservations: Number(r.reservations),
      completed,
      cancelled: Number(r.cancelled),
      storeCancelled: Number(r.store_cancelled),
      resolved,
      noShow: Number(r.no_show),
      gmv: Number(r.gmv),
      commission: Number(r.commission),
      failedCheckins: Number(r.failed_checkins),
      qrRate: resolved > 0 ? completed / resolved : null,
      flag: storeFlag(resolved, completed),
    };
  });
}

export async function getAdminStore(storeId: string) {
  return asService(async (q) => {
    const [store] = await q.query(
      `select id, slug, name, area_id, category::text as category, status::text as status, plan_code, address, phone,
              opening_hours, qr_version, is_demo, created_at
       from public.stores where id = $1`,
      [storeId],
    );
    if (!store) return null;
    const members = await q.query<{ user_id: string; role: string; display_name: string; line_linked: boolean }>(
      `select m.user_id, m.role::text as role, u.display_name, (u.line_user_id is not null) as line_linked
       from public.store_members m join public.users u on u.id = m.user_id where m.store_id = $1 order by m.role`,
      [storeId],
    );
    const failures = await q.query<{ result: string; count: number }>(
      `select result, count(*)::int as count from public.checkins
       where store_id = $1 and result <> 'success' and created_at > now() - interval '30 days'
       group by result order by count desc`,
      [storeId],
    );
    const planChanges = await q.query<{ from_plan: string; to_plan: string; created_at: Date }>(
      "select from_plan, to_plan, created_at from public.store_plan_changes where store_id = $1 order by created_at desc limit 10",
      [storeId],
    );
    return {
      store: { ...store, created_at: isoStr(store.created_at) } as Record<string, unknown>,
      members,
      failures,
      planChanges: planChanges.map((p) => ({ ...p, created_at: isoStr(p.created_at) })),
    };
  });
}

export async function adminUpdateStore(storeId: string, data: { status?: string; plan?: string }) {
  await asService(async (q) => {
    if (data.status) {
      if (!["pending", "active", "suspended"].includes(data.status)) throw new AppError("validation");
      await q.query("update public.stores set status = $2::public.store_status where id = $1", [storeId, data.status]);
    }
    if (data.plan) {
      if (!isPlanCode(data.plan)) throw new AppError("invalid_plan");
      const [cur] = await q.query<{ plan_code: string }>("select plan_code from public.stores where id = $1 for update", [storeId]);
      if (cur && cur.plan_code !== data.plan) {
        await q.query("update public.stores set plan_code = $2 where id = $1", [storeId, data.plan]);
        await q.query("insert into public.store_plan_changes (store_id, from_plan, to_plan) values ($1, $2, $3)", [
          storeId,
          cur.plan_code,
          data.plan,
        ]);
      }
    }
  });
}

export async function adminAddMember(storeId: string, userId: string, role: "owner" | "staff") {
  await asService(async (q) => {
    const [user] = await q.query("select id from public.users where id = $1", [userId]);
    if (!user) throw new AppError("validation", "ユーザーが見つかりません。ユーザー一覧の ID を指定してください。");
    await q.query(
      `insert into public.store_members (store_id, user_id, role) values ($1, $2, $3::public.member_role)
       on conflict (store_id, user_id) do update set role = excluded.role`,
      [storeId, userId, role],
    );
  });
}

export async function adminRemoveMember(storeId: string, userId: string) {
  await asService((q) => q.query("delete from public.store_members where store_id = $1 and user_id = $2", [storeId, userId]));
}

export async function adminCreateStore(data: { name: string; slug: string; areaId: string; category: string }) {
  return asService(async (q) => {
    const [row] = await q.query<{ id: string }>(
      `insert into public.stores (name, slug, area_id, category, status) values ($1, $2, $3, $4::public.product_category, 'pending')
       returning id`,
      [data.name, data.slug, data.areaId, data.category],
    );
    return row.id;
  });
}

export async function listUsers(search: string | undefined, limit = 200) {
  const rows = await asService((q) =>
    q.query(
      `select u.id, u.display_name, (u.line_user_id is not null) as line_linked, u.is_demo, u.created_at, u.last_seen_at,
              coalesce(st.reservation_count, 0)::int as reservations, coalesce(st.completed_count, 0)::int as completed,
              coalesce(st.cancelled_count, 0)::int as cancelled, coalesce(st.no_show_count, 0)::int as no_show,
              coalesce(st.points_balance, 0)::int as points, coalesce(st.trust_score, 100)::int as trust_score,
              exists (select 1 from public.admin_users a where a.user_id = u.id) as is_admin,
              (select string_agg(s.name || '（' || m.role || '）', '、') from public.store_members m
                 join public.stores s on s.id = m.store_id where m.user_id = u.id) as stores
       from public.users u left join public.user_stats st on st.user_id = u.id
       where ($1::text is null or u.display_name ilike '%' || $1 || '%' or u.id::text = $1)
       order by u.last_seen_at desc nulls last, u.created_at desc
       limit $2`,
      [search?.trim() || null, limit],
    ),
  );
  return rows.map((r): AdminRow => ({ ...r, id: String(r.id), created_at: isoStr(r.created_at), last_seen_at: isoOrNull(r.last_seen_at) }));
}

export async function listAllProducts(scope: "live" | "recent", limit = 200) {
  const rows = await asService((q) =>
    q.query(
      `select p.id, p.name, p.status::text as status, p.quantity, p.remaining_quantity, p.rescue_price, p.original_price,
              p.pickup_start_at, p.pickup_end_at, p.is_box, s.name as store_name, s.status::text as store_status,
              (select count(*) from public.reservations r where r.product_id = p.id and r.status <> 'cancelled')::int as reserved
       from public.products p join public.stores s on s.id = p.store_id
       where ${scope === "live" ? "p.pickup_end_at > now() and p.deleted_at is null" : "true"}
       order by p.pickup_start_at desc limit $1`,
      [limit],
    ),
  );
  return rows.map((r): AdminRow => ({ ...r, id: String(r.id), pickup_start_at: isoStr(r.pickup_start_at), pickup_end_at: isoStr(r.pickup_end_at) }));
}

export async function listAllReservations(status: string | undefined, limit = 300) {
  const valid = ["pending", "confirmed", "completed", "cancelled", "no_show", "expired"];
  const filter = status && valid.includes(status) ? status : null;
  const rows = await asService((q) =>
    q.query(
      `select r.id, r.code, r.status::text as status, r.quantity, r.total_price, r.pickup_start_at, r.pickup_end_at,
              r.created_at, r.completed_at, r.cancelled_by::text as cancelled_by, r.plan_code,
              floor(r.total_price * coalesce(r.commission_rate, 0))::int as commission,
              p.name as product_name, s.name as store_name, u.display_name as user_name
       from public.reservations r
       join public.products p on p.id = r.product_id
       join public.stores s on s.id = r.store_id
       join public.users u on u.id = r.user_id
       where ($1::text is null or r.status::text = $1)
       order by ${filter === "completed" ? "r.completed_at" : "r.created_at"} desc
       limit $2`,
      [filter, limit],
    ),
  );
  return rows.map((r): AdminRow => ({
    ...r,
    id: String(r.id),
    pickup_start_at: isoStr(r.pickup_start_at),
    pickup_end_at: isoStr(r.pickup_end_at),
    created_at: isoStr(r.created_at),
    completed_at: isoOrNull(r.completed_at),
  }));
}

export async function runSweep() {
  const [row] = await asService((q) => q.query<{ data: Record<string, number> }>("select public.sweep_reservations() as data"));
  return row.data;
}

export async function runAutoRelist() {
  const [row] = await asService((q) => q.query<{ count: number }>("select public.auto_relist_templates() as count"));
  return Number(row.count);
}

export async function refreshDemoData() {
  await asService(async (q) => {
    const [{ demo_only }] = await q.query<{ demo_only: boolean }>("select coalesce(bool_and(is_demo), true) as demo_only from public.stores");
    if (!demo_only) throw new AppError("forbidden", "デモ以外の店舗があるため実行できません。");
    await refreshDemoListings(q);
  });
}

/** 月次の請求データ（手数料）を作成・更新する。商品代金の入金処理は行わない。 */
export async function generateBilling(month: string) {
  const range = jstMonthRange(month);
  return asService(async (q) => {
    const stores = await q.query<{ id: string; plan_code: string; status: string }>(
      "select id, plan_code, status::text from public.stores where status <> 'pending'",
    );
    const completions = await q.query<{ store_id: string; total_price: number; commission_rate: number | null; plan_code: string | null }>(
      `select store_id, total_price, commission_rate::float8 as commission_rate, plan_code from public.reservations
       where status = 'completed' and completed_at >= $1 and completed_at < $2`,
      [range.start.toISOString(), range.end.toISOString()],
    );
    let count = 0;
    for (const s of stores) {
      const plan = isPlanCode(s.plan_code) ? s.plan_code : "free";
      const rows = completions.filter((c) => c.store_id === s.id);
      const fee = calcMonthlyFeeFromCompletions(
        plan,
        rows.map((r) => ({ totalPrice: Number(r.total_price), commissionRate: r.commission_rate, planCode: r.plan_code })),
      );
      await q.query(
        `insert into public.billing_records (store_id, period_month, plan_code, monthly_fee, gmv, completed_count,
           commission_amount, total_amount, status)
         values ($1, $2::date, $3, $4, $5, $6, $7, $8, 'draft')
         on conflict (store_id, period_month) do update set
           plan_code = excluded.plan_code, monthly_fee = excluded.monthly_fee, gmv = excluded.gmv,
           completed_count = excluded.completed_count, commission_amount = excluded.commission_amount,
           total_amount = excluded.total_amount
         where public.billing_records.status = 'draft'`,
        [s.id, `${range.month}-01`, plan, fee.monthlyFee, fee.gmv, rows.length, fee.commission, fee.total],
      );
      count++;
    }
    return count;
  });
}

export async function listBilling(month: string) {
  const range = jstMonthRange(month);
  return asService((q) =>
    q.query<{
      store_name: string;
      plan_code: string;
      monthly_fee: number;
      gmv: number;
      completed_count: number;
      commission_amount: number;
      total_amount: number;
      status: string;
    }>(
      `select s.name as store_name, b.plan_code, b.monthly_fee, b.gmv, b.completed_count, b.commission_amount, b.total_amount, b.status
       from public.billing_records b join public.stores s on s.id = b.store_id
       where b.period_month = $1::date order by b.total_amount desc`,
      [`${range.month}-01`],
    ),
  );
}
