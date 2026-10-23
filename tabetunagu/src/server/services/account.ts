import "server-only";
import { FILTER_STATUSES, type OrderFilter, type PointType } from "@/lib/my-orders";
import type { OrderStatus } from "@/lib/orders";
import { asUser } from "../db";

/**
 * マイページ・注文履歴・ポイント履歴（v2）。どれも本人の行だけ（asUser + RLS）。
 * 決済・返金の内部 ID（Stripe の ID など）、IP・User-Agent、LINE の内部 ID は返さない。
 */

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export type MyOrderCard = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  storeName: string;
  itemsLabel: string;
  imageUrl: string | null;
  category: string;
  total: number;
  createdAt: string;
  pickupStartAt: string;
  pickupEndAt: string;
  pickedUpAt: string | null;
  /** まだ支払える（お支払い待ちで期限内） */
  payable: boolean;
  /** 返金（返金済みの注文のみ。成功した返金の金額・日時。手続き中は pending） */
  refund: { amount: number; status: "succeeded" | "pending"; at: string } | null;
};

const ORDER_CARD_COLUMNS = `
  o.id, o.order_number, o.status::text as status, o.total, o.created_at, o.pickup_start, o.pickup_end, o.picked_up_at,
  o.payment_expires_at, s.name as store_name,
  (select string_agg(i.product_name_snapshot || ' ×' || i.quantity, '・' order by i.created_at)
     from public.order_items i where i.order_id = o.id) as items_label,
  (select json_build_object('url', p.image_url, 'category', p.category::text)
     from public.order_items i join public.products p on p.id = i.product_id
     where i.order_id = o.id order by i.created_at limit 1) as visual,
  (select json_build_object('amount', r.amount, 'status', r.status, 'at', coalesce(r.succeeded_at, r.created_at))
     from public.refunds r where r.order_id = o.id and r.scope = 'order' and r.status in ('succeeded', 'pending', 'requested')
     order by r.created_at desc limit 1) as refund`;

function toCard(r: Record<string, unknown>, now: Date): MyOrderCard {
  const status = r.status as OrderStatus;
  const visual = r.visual as { url: string | null; category: string | null } | null;
  const refund = r.refund as { amount: number; status: string; at: string } | null;
  return {
    id: String(r.id),
    orderNumber: String(r.order_number),
    status,
    storeName: String(r.store_name),
    itemsLabel: String(r.items_label ?? ""),
    imageUrl: visual?.url ?? null,
    category: visual?.category ?? "other",
    total: Number(r.total),
    createdAt: iso(r.created_at)!,
    pickupStartAt: iso(r.pickup_start)!,
    pickupEndAt: iso(r.pickup_end)!,
    pickedUpAt: iso(r.picked_up_at),
    payable: status === "pending_payment" && Date.parse(iso(r.payment_expires_at)!) > now.getTime(),
    refund:
      status === "refunded" && refund
        ? { amount: Number(refund.amount), status: refund.status === "succeeded" ? "succeeded" : "pending", at: iso(refund.at)! }
        : null,
  };
}

export type MyAccountSummary = {
  /** つなぐポイントの残高（台帳 points_transactions の合計。user_stats.points_balance は使わない） */
  points: number;
  /** 過去の食べつなぎ（v2 の受取完了の件数。未受取・返金・キャンセルは含めない） */
  pickedUpCount: number;
  /** 注文の件数（空状態の判定用） */
  orderCount: number;
  /** 決済済みの注文（受取開始の近い順。最大10件） */
  paidOrders: MyOrderCard[];
  /** 最近の注文（新しい順・3件。受取待ちは上の欄に出すので除く） */
  recentOrders: MyOrderCard[];
  favorites: { id: string; slug: string; name: string; areaId: string; live: number }[];
  favoriteCount: number;
};

/**
 * マイページに必要な値を1回の接続（1トランザクション・4クエリ）で取得する。全件取得はしない。
 */
export async function getMyAccountSummary(userId: string, now = new Date()): Promise<MyAccountSummary> {
  return asUser(userId, async (q) => {
    const [stats] = await q.query<{ points: number; picked_up: number; orders: number; favorites: number }>(
      `select public.points_balance($1::uuid) as points,
              (select count(*)::int from public.orders where user_id = $1 and status = 'picked_up') as picked_up,
              (select count(*)::int from public.orders where user_id = $1) as orders,
              (select count(*)::int from public.favorites where user_id = $1) as favorites`,
      [userId],
    );
    const paid = await q.query<Record<string, unknown>>(
      `select ${ORDER_CARD_COLUMNS}
       from public.orders o join public.stores s on s.id = o.store_id
       where o.user_id = $1 and o.status = 'paid'
       order by o.pickup_start, o.id
       limit 10`,
      [userId],
    );
    const recent = await q.query<Record<string, unknown>>(
      `select ${ORDER_CARD_COLUMNS}
       from public.orders o join public.stores s on s.id = o.store_id
       where o.user_id = $1 and o.status <> 'paid'
       order by o.created_at desc, o.id desc
       limit 3`,
      [userId],
    );
    const favorites = await q.query<{ id: string; slug: string; name: string; area_id: string; live: number }>(
      `select s.id, s.slug, s.name, s.area_id,
              (select count(*)::int from public.products p
                where p.store_id = s.id and p.status = 'published' and p.deleted_at is null and p.pickup_end_at > now()) as live
       from public.favorites f join public.stores s on s.id = f.store_id
       where f.user_id = $1 order by f.created_at desc limit 3`,
      [userId],
    );
    return {
      points: Number(stats?.points ?? 0),
      pickedUpCount: Number(stats?.picked_up ?? 0),
      orderCount: Number(stats?.orders ?? 0),
      paidOrders: paid.map((r) => toCard(r, now)),
      recentOrders: recent.map((r) => toCard(r, now)),
      favorites: favorites.map((f) => ({ id: f.id, slug: f.slug, name: f.name, areaId: f.area_id, live: Number(f.live) })),
      favoriteCount: Number(stats?.favorites ?? 0),
    };
  });
}

export const ORDER_PAGE_SIZE = 20;

/**
 * 注文履歴。新しい注文が上（created_at DESC）。ページ単位で取得し、次のページがあるかを返す。
 */
export async function listMyOrderHistory(
  userId: string,
  filter: OrderFilter,
  opts: { page?: number; now?: Date } = {},
): Promise<{ items: MyOrderCard[]; hasMore: boolean }> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const now = opts.now ?? new Date();
  const rows = await asUser(userId, (q) =>
    q.query<Record<string, unknown>>(
      `select ${ORDER_CARD_COLUMNS}
       from public.orders o join public.stores s on s.id = o.store_id
       where o.user_id = $1 and o.status::text = any(string_to_array($2, ','))
       order by o.created_at desc, o.id desc
       limit $3 offset $4`,
      [userId, FILTER_STATUSES[filter].join(","), ORDER_PAGE_SIZE + 1, (page - 1) * ORDER_PAGE_SIZE],
    ),
  );
  return { items: rows.slice(0, ORDER_PAGE_SIZE).map((r) => toCard(r, now)), hasMore: rows.length > ORDER_PAGE_SIZE };
}

export type MyPointEntry = { id: string; amount: number; type: PointType; createdAt: string };

/** ポイント履歴（新しい順）。内部の理由（reason）・注文 ID は返さない */
export async function listMyPointHistory(userId: string, limit = 50): Promise<MyPointEntry[]> {
  const rows = await asUser(userId, (q) =>
    q.query<{ id: string; amount: number; type: PointType; created_at: string }>(
      `select id, amount, type, created_at from public.points_transactions
       where user_id = $1 order by created_at desc, id desc limit $2`,
      [userId, Math.min(Math.max(1, limit), 200)],
    ),
  );
  return rows.map((r) => ({ id: String(r.id), amount: Number(r.amount), type: r.type, createdAt: iso(r.created_at)! }));
}
