import "server-only";
import { AppError } from "@/lib/errors";
import { pickupPhase, type MonitorOrder, type MonitorSnapshot, type PickupPhase } from "@/lib/monitor";
import type { OrderStatus } from "@/lib/orders";
import { asService, asUser } from "../db";
import { maskName } from "./store";

/**
 * v2 の受取（デジタル受取チケット・自己スワイプ）と店舗モニター。
 * 受取完了はユーザー本人のスワイプだけ。店舗側の完了操作はない。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PickupMetadata = {
  ip?: string | null;
  userAgent?: string | null;
  /** スワイプにかかった時間（ミリ秒） */
  swipeMs?: number | null;
};

/** 受取完了（本人のスワイプ）。受取済みなら何もしない（冪等） */
export async function pickupOrder(userId: string, orderId: string, meta: PickupMetadata = {}) {
  if (!UUID_RE.test(orderId)) throw new AppError("order_not_found");
  const metadata = {
    method: "swipe",
    ip: meta.ip ? String(meta.ip).slice(0, 64) : null,
    user_agent: meta.userAgent ? String(meta.userAgent).slice(0, 300) : null,
    swipe_ms: Number.isFinite(meta.swipeMs) ? Math.max(0, Math.min(600_000, Math.round(meta.swipeMs as number))) : null,
    // 将来: 店舗コード・店頭 QR・NFC・Bluetooth などの確認結果をここに追加する
    verification: null,
  };
  const [{ data }] = await asUser(userId, (q) =>
    q.query<{ data: { result: "picked_up" | "already_picked_up"; picked_up_at: string } }>(
      "select public.pickup_order($1::uuid, $2::jsonb) as data",
      [orderId, JSON.stringify(metadata)],
    ),
  );
  return data;
}

// ---------------------------------------------------------------------------
// 画面を開いたときの状態更新（決済期限切れ・未受取）
// 高頻度の Cron がなくても、店舗モニター・注文画面を開くたびに店舗単位で反映する。
// 同じ店舗には一定間隔でしか実行しない（モニターの数秒ごとの更新で DB に負荷をかけない）。
// ---------------------------------------------------------------------------
const MAINTAIN_INTERVAL_MS = 15_000;
type MaintainHolder = { last: Map<string, number> };
const maintainHolder: MaintainHolder = ((globalThis as { __tabetunaguMaintain?: MaintainHolder }).__tabetunaguMaintain ??= {
  last: new Map(),
});

export async function maintainStoreOrders(storeId: string, opts: { force?: boolean } = {}) {
  const now = Date.now();
  const last = maintainHolder.last.get(storeId) ?? 0;
  if (!opts.force && now - last < MAINTAIN_INTERVAL_MS) return null;
  maintainHolder.last.set(storeId, now);
  const [{ data }] = await asService((q) =>
    q.query<{ data: { expired_orders: number; unclaimed_orders: number } }>(
      "select public.maintain_store_orders($1::uuid) as data",
      [storeId],
    ),
  );
  return data;
}

/** 全店舗の未受取判定（Cron / 外部スケジューラー用） */
export async function markUnclaimedOrders() {
  const [{ count }] = await asService((q) => q.query<{ count: number }>("select public.mark_unclaimed_orders() as count"));
  return Number(count);
}

// ---------------------------------------------------------------------------
// 店舗モニター
// ---------------------------------------------------------------------------

/** JST の今日 0:00 と翌日 0:00 */
function jstDayRange(now: Date) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(now);
  const start = new Date(`${day}T00:00:00+09:00`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

type MonitorRow = {
  id: string;
  order_number: string;
  status: "paid" | "picked_up" | "unclaimed";
  pickup_start: Date | string;
  pickup_end: Date | string;
  picked_up_at: Date | string | null;
  updated_at: Date | string;
  display_name: string | null;
  items: { name: string; quantity: number }[] | null;
};

const iso = (v: Date | string) => new Date(v).toISOString();

/**
 * 今日（JST）の受取対象の注文（決済済み・受取済み・未受取）。店舗メンバーのみ（RLS + メンバー確認）。
 * お客様の名前は一部を伏せて表示する。
 */
export async function getStoreMonitor(userId: string, storeId: string, now = new Date()): Promise<MonitorSnapshot> {
  if (!UUID_RE.test(storeId)) throw new AppError("forbidden");
  const { start, end } = jstDayRange(now);
  return asUser(userId, async (q) => {
    const [store] = await q.query<{ name: string; member: boolean }>(
      "select s.name, public.is_store_member(s.id) as member from public.stores s where s.id = $1",
      [storeId],
    );
    if (!store?.member) throw new AppError("forbidden");
    const rows = await q.query<MonitorRow>(
      `select o.id, o.order_number, o.status::text as status, o.pickup_start, o.pickup_end, o.picked_up_at, o.updated_at,
              u.display_name,
              (select jsonb_agg(jsonb_build_object('name', i.product_name_snapshot, 'quantity', i.quantity) order by i.created_at)
                 from public.order_items i where i.order_id = o.id) as items
       from public.orders o
       left join public.users u on u.id = o.user_id
       where o.store_id = $1
         and o.status in ('paid', 'picked_up', 'unclaimed')
         and o.pickup_start < $3 and o.pickup_end >= $2
       order by o.pickup_start, o.created_at`,
      [storeId, start.toISOString(), end.toISOString()],
    );
    const t = now.getTime();
    const orders: MonitorOrder[] = rows.map((r) => {
      const base = {
        status: r.status,
        pickupStartAt: iso(r.pickup_start),
        pickupEndAt: iso(r.pickup_end),
      };
      return {
        id: r.id,
        orderNumber: r.order_number,
        ...base,
        customerName: maskName(String(r.display_name ?? "")),
        items: (r.items ?? []).map((i) => ({ name: i.name, quantity: Number(i.quantity) })),
        pickedUpAt: r.picked_up_at ? iso(r.picked_up_at) : null,
        phase: pickupPhase(base, t),
      };
    });
    const latest = rows.reduce((m, r) => Math.max(m, Date.parse(iso(r.updated_at))), 0);
    // 区分は時刻でも変わるため、分単位の時刻も version に含める
    const phases = orders.map((o) => o.phase[0]).join("");
    return {
      storeId,
      storeName: store.name,
      generatedAt: now.toISOString(),
      version: `${rows.length}:${latest}:${phases}`,
      orders,
    };
  });
}

// ---------------------------------------------------------------------------
// 店舗の注文一覧（v2）
// ---------------------------------------------------------------------------

export type StoreOrderRow = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  phase: PickupPhase | null;
  customerName: string;
  items: { name: string; quantity: number }[];
  total: number;
  subtotal: number;
  pickupStartAt: string;
  pickupEndAt: string;
  paidAt: string | null;
  pickedUpAt: string | null;
  /** 店舗都合で返金できる（決済済み・受取前） */
  storeRefundable: boolean;
};

export async function listStoreOrders(userId: string, storeId: string, now = new Date()): Promise<StoreOrderRow[]> {
  if (!UUID_RE.test(storeId)) throw new AppError("forbidden");
  const { start, end } = jstDayRange(now);
  return asUser(userId, async (q) => {
    const [member] = await q.query<{ ok: boolean }>("select public.is_store_member($1::uuid) as ok", [storeId]);
    if (!member?.ok) throw new AppError("forbidden");
    const rows = await q.query<Record<string, unknown>>(
      `select o.id, o.order_number, o.status::text as status, o.total, o.subtotal, o.pickup_start, o.pickup_end,
              o.paid_at, o.picked_up_at, u.display_name,
              (select jsonb_agg(jsonb_build_object('name', i.product_name_snapshot, 'quantity', i.quantity) order by i.created_at)
                 from public.order_items i where i.order_id = o.id) as items
       from public.orders o left join public.users u on u.id = o.user_id
       where o.store_id = $1 and o.pickup_start < $3 and o.pickup_end >= $2
         and o.status in ('paid', 'picked_up', 'unclaimed', 'refunded')
       order by o.pickup_start, o.created_at`,
      [storeId, start.toISOString(), end.toISOString()],
    );
    const t = now.getTime();
    return rows.map((r) => {
      const status = r.status as OrderStatus;
      const pickupStartAt = iso(r.pickup_start as string);
      const pickupEndAt = iso(r.pickup_end as string);
      return {
        id: String(r.id),
        orderNumber: String(r.order_number),
        status,
        phase: status === "refunded" ? null : pickupPhase({ status, pickupStartAt, pickupEndAt }, t),
        customerName: maskName(String(r.display_name ?? "")),
        items: ((r.items as { name: string; quantity: number }[] | null) ?? []).map((i) => ({ name: i.name, quantity: Number(i.quantity) })),
        total: Number(r.total),
        subtotal: Number(r.subtotal),
        pickupStartAt,
        pickupEndAt,
        paidAt: r.paid_at ? iso(r.paid_at as string) : null,
        pickedUpAt: r.picked_up_at ? iso(r.picked_up_at as string) : null,
        storeRefundable: status === "paid",
      };
    });
  });
}

// ---------------------------------------------------------------------------
// ユーザーの注文履歴（v2）
// ---------------------------------------------------------------------------

export type MyOrderTab = "pending" | "ready" | "picked_up" | "unclaimed" | "refunded" | "cancelled";

const TAB_STATUS: Record<MyOrderTab, OrderStatus> = {
  pending: "pending_payment",
  ready: "paid",
  picked_up: "picked_up",
  unclaimed: "unclaimed",
  refunded: "refunded",
  cancelled: "cancelled",
};

export type MyOrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  storeName: string;
  itemsLabel: string;
  total: number;
  pickupStartAt: string;
  pickupEndAt: string;
};

export async function listMyOrders(userId: string, tab: MyOrderTab): Promise<MyOrderListItem[]> {
  const status = TAB_STATUS[tab];
  const rows = await asUser(userId, (q) =>
    q.query<Record<string, unknown>>(
      `select o.id, o.order_number, o.status::text as status, o.total, o.pickup_start, o.pickup_end, s.name as store_name,
              (select string_agg(i.product_name_snapshot || ' ×' || i.quantity, '・' order by i.created_at)
                 from public.order_items i where i.order_id = o.id) as items_label
       from public.orders o join public.stores s on s.id = o.store_id
       where o.user_id = $1 and o.status = $2::public.order_status
       order by o.pickup_start ${tab === "ready" || tab === "pending" ? "asc" : "desc"}
       limit 100`,
      [userId, status],
    ),
  );
  return rows.map((r) => ({
    id: String(r.id),
    orderNumber: String(r.order_number),
    status: r.status as OrderStatus,
    storeName: String(r.store_name),
    itemsLabel: String(r.items_label ?? ""),
    total: Number(r.total),
    pickupStartAt: iso(r.pickup_start as string),
    pickupEndAt: iso(r.pickup_end as string),
  }));
}

/** 注文があるか（旧予約の画面から v2 の注文履歴へ案内するため） */
export async function hasMyOrders(userId: string) {
  const [row] = await asUser(userId, (q) =>
    q.query<{ ok: boolean }>("select exists (select 1 from public.orders where user_id = $1) as ok", [userId]),
  );
  return Boolean(row?.ok);
}
