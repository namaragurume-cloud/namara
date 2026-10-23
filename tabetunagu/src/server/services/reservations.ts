import "server-only";
import { AppError } from "@/lib/errors";
import type { ReservationView } from "@/lib/types";
import { asUser } from "../db";
import { RESERVATION_COLUMNS, toReservationView } from "./mappers";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 予約を作成する（在庫の減算・売り切れ判定は DB 関数で原子的に行う） */
export async function createReservation(userId: string, productId: string, quantity: number) {
  if (!UUID_RE.test(productId)) throw new AppError("product_not_found");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new AppError("invalid_quantity");
  return asUser(userId, async (q) => {
    const [row] = await q.query<{ id: string; code: string }>(
      "select id, code from public.reserve_product($1::uuid, $2::int)",
      [productId, quantity],
    );
    return row;
  });
}

export async function cancelReservation(userId: string, reservationId: string, reason?: string) {
  if (!UUID_RE.test(reservationId)) throw new AppError("reservation_not_found");
  return asUser(userId, async (q) => {
    const [row] = await q.query<{ id: string; status: string }>(
      "select id, status::text from public.cancel_reservation($1::uuid, $2)",
      [reservationId, reason ?? null],
    );
    return row;
  });
}

export type ReservationTab = "upcoming" | "past" | "cancelled";

export async function listMyReservations(userId: string, tab: ReservationTab, now = new Date()): Promise<ReservationView[]> {
  const where =
    tab === "upcoming"
      ? `r.status in ('pending', 'confirmed') and r.pickup_end_at + interval '30 minutes' > $2`
      : tab === "past"
        ? `(r.status in ('completed', 'no_show', 'expired') or (r.status in ('pending', 'confirmed') and r.pickup_end_at + interval '30 minutes' <= $2))`
        : `r.status = 'cancelled'`;
  const order = tab === "upcoming" ? "r.pickup_start_at asc" : "r.pickup_start_at desc";
  const rows = await asUser(userId, (q) =>
    q.query(
      `select ${RESERVATION_COLUMNS}
       from public.reservations r
       join public.products p on p.id = r.product_id
       join public.stores s on s.id = r.store_id
       where r.user_id = $1 and ${where}
       order by ${order}
       limit 100`,
      tab === "cancelled" ? [userId] : [userId, now.toISOString()],
    ),
  );
  return rows.map(toReservationView);
}

export async function getMyReservation(userId: string, reservationId: string): Promise<ReservationView | null> {
  if (!UUID_RE.test(reservationId)) return null;
  const [row] = await asUser(userId, (q) =>
    q.query(
      `select ${RESERVATION_COLUMNS}
       from public.reservations r
       join public.products p on p.id = r.product_id
       join public.stores s on s.id = r.store_id
       where r.id = $1 and r.user_id = $2`,
      [reservationId, userId],
    ),
  );
  return row ? toReservationView(row) : null;
}

export type MyStats = {
  reservationCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  points: number;
  trustScore: number;
  foodSavedG: number;
  completedQuantity: number;
  /** v2（事前決済）の受取完了の件数・推定削減量（旧フローの値とは別に数える） */
  v2PickedUpCount: number;
  v2FoodSavedG: number;
};

export async function getMyStats(userId: string): Promise<MyStats> {
  return asUser(userId, async (q) => {
    const [stats] = await q.query<{
      reservation_count: number;
      completed_count: number;
      cancelled_count: number;
      no_show_count: number;
      trust_score: number;
    }>("select * from public.user_stats where user_id = $1", [userId]);
    const [saved] = await q.query<{ grams: number; qty: number }>(
      `select coalesce(sum(r.quantity * p.estimated_weight_g), 0)::int as grams, coalesce(sum(r.quantity), 0)::int as qty
       from public.reservations r join public.products p on p.id = r.product_id
       where r.user_id = $1 and r.status = 'completed'`,
      [userId],
    );
    const [v2] = await q.query<{ count: number; grams: number }>(
      `select count(distinct o.id)::int as count, coalesce(sum(i.quantity * p.estimated_weight_g), 0)::int as grams
       from public.orders o join public.order_items i on i.order_id = o.id join public.products p on p.id = i.product_id
       where o.user_id = $1 and o.status = 'picked_up'`,
      [userId],
    );
    // ポイント残高は台帳（points_transactions）の合計が正。user_stats.points_balance は旧フローの互換用
    const [points] = await q.query<{ balance: number }>("select public.points_balance($1::uuid) as balance", [userId]);
    return {
      reservationCount: stats?.reservation_count ?? 0,
      completedCount: stats?.completed_count ?? 0,
      cancelledCount: stats?.cancelled_count ?? 0,
      noShowCount: stats?.no_show_count ?? 0,
      points: Number(points?.balance ?? 0),
      trustScore: stats?.trust_score ?? 100,
      foodSavedG: saved?.grams ?? 0,
      completedQuantity: saved?.qty ?? 0,
      v2PickedUpCount: v2?.count ?? 0,
      v2FoodSavedG: v2?.grams ?? 0,
    };
  });
}

/** QR チェックインで同時に完了した予約（完了画面用） */
export async function getCompletedGroup(userId: string, reservationId: string) {
  const main = await getMyReservation(userId, reservationId);
  if (!main || main.status !== "completed" || !main.completedAt) return null;
  const rows = await asUser(userId, (q) =>
    q.query(
      `select ${RESERVATION_COLUMNS}, coalesce(pt.amount, 0)::int as points
       from public.reservations r
       join public.products p on p.id = r.product_id
       join public.stores s on s.id = r.store_id
       left join public.points_transactions pt on pt.reservation_id = r.id and pt.reason = 'checkin'
       where r.user_id = $1 and r.store_id = $2 and r.status = 'completed'
         and r.completed_at between $3::timestamptz - interval '5 seconds' and $3::timestamptz + interval '5 seconds'
       order by r.pickup_start_at`,
      [userId, main.storeId, main.completedAt],
    ),
  );
  return {
    reservations: rows.map(toReservationView),
    points: rows.reduce((sum, r) => sum + Number(r.points), 0),
  };
}

export async function listFavoriteStores(userId: string) {
  return asUser(userId, (q) =>
    q.query<{ id: string; slug: string; name: string; area_id: string; category: string; live: number }>(
      `select s.id, s.slug, s.name, s.area_id, s.category::text as category,
              (select count(*)::int from public.products p
                where p.store_id = s.id and p.status = 'published' and p.deleted_at is null and p.pickup_end_at > now()) as live
       from public.favorites f join public.stores s on s.id = f.store_id
       where f.user_id = $1 order by f.created_at desc`,
      [userId],
    ),
  );
}

export async function setFavorite(userId: string, storeId: string, favorite: boolean) {
  if (!UUID_RE.test(storeId)) throw new AppError("validation");
  return asUser(userId, async (q) => {
    if (favorite) {
      await q.query(
        `insert into public.favorites (user_id, store_id)
         select $1, s.id from public.stores s where s.id = $2 and s.status = 'active'
         on conflict do nothing`,
        [userId, storeId],
      );
    } else {
      await q.query("delete from public.favorites where user_id = $1 and store_id = $2", [userId, storeId]);
    }
  });
}

export async function getMyProfile(userId: string) {
  const [row] = await asUser(userId, (q) =>
    q.query<{ display_name: string; notify_enabled: boolean; notify_areas: string[]; line_user_id: string | null }>(
      "select display_name, notify_enabled, notify_areas, line_user_id from public.my_profile()",
    ),
  );
  return row ?? null;
}

export async function updateNotificationSettings(userId: string, enabled: boolean, areas: string[]) {
  await asUser(userId, (q) =>
    q.query("update public.users set notify_enabled = $2, notify_areas = $3::text[] where id = $1", [userId, enabled, areas]),
  );
}
