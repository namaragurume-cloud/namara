import "server-only";
import { AppError } from "@/lib/errors";
import type { OrderStatus } from "@/lib/orders";
import { asService, asUser } from "../db";

/**
 * v2 注文（事前決済）の基盤。STEP 1 では画面・決済とはまだ接続しない。
 * 在庫の仮押さえ・金額計算・状態遷移・ポイント付与はすべて DB 関数で行う。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  tsunaguCharge: number;
  total: number;
  commissionBps: number;
  commissionAmount: number;
  platformFeeTotal: number;
  paymentExpiresAt: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  tsunagu_charge: number;
  total: number;
  commission_bps: number;
  commission_amount: number;
  platform_fee_total: number;
  payment_expires_at: Date | string;
};

const ORDER_SUMMARY_COLUMNS = `id, order_number, status::text, subtotal, tsunagu_charge, total, commission_bps,
  commission_amount, platform_fee_total, payment_expires_at`;

function toOrderSummary(r: OrderRow): OrderSummary {
  return {
    id: r.id,
    orderNumber: r.order_number,
    status: r.status,
    subtotal: Number(r.subtotal),
    tsunaguCharge: Number(r.tsunagu_charge),
    total: Number(r.total),
    commissionBps: Number(r.commission_bps),
    commissionAmount: Number(r.commission_amount),
    platformFeeTotal: Number(r.platform_fee_total),
    paymentExpiresAt: new Date(r.payment_expires_at).toISOString(),
  };
}

/** 注文を作成し在庫を仮押さえする（状態は pending_payment。決済はまだ行わない） */
export async function createOrder(userId: string, productId: string, quantity: number): Promise<OrderSummary> {
  if (!UUID_RE.test(productId)) throw new AppError("product_not_found");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new AppError("invalid_quantity");
  const [row] = await asUser(userId, (q) =>
    q.query<OrderRow>(`select ${ORDER_SUMMARY_COLUMNS} from public.create_order($1::uuid, $2::int)`, [productId, quantity]),
  );
  return toOrderSummary(row);
}

/** 決済前の注文を本人が中断する（在庫を戻す） */
export async function cancelPendingOrder(userId: string, orderId: string): Promise<OrderSummary> {
  if (!UUID_RE.test(orderId)) throw new AppError("order_not_found");
  const [row] = await asUser(userId, (q) =>
    q.query<OrderRow>(`select ${ORDER_SUMMARY_COLUMNS} from public.cancel_pending_order($1::uuid)`, [orderId]),
  );
  return toOrderSummary(row);
}

/** 決済期限切れの注文を cancelled にして在庫を戻す（バッチ） */
export async function sweepOrders() {
  const [row] = await asService((q) => q.query<{ data: { expired_orders: number } }>("select public.sweep_orders() as data"));
  return row.data;
}

/** paid の注文に つなぐポイントを付与する（同じ注文には1回だけ） */
export async function grantOrderPoints(orderId: string) {
  if (!UUID_RE.test(orderId)) throw new AppError("order_not_found");
  const [row] = await asService((q) =>
    q.query<{ data: { granted: boolean; points: number } }>("select public.grant_order_points($1::uuid) as data", [orderId]),
  );
  return row.data;
}

/** 全額返金された注文の付与ポイントを取り消す（付与済みの場合のみ・1回だけ） */
export async function revokeOrderPoints(orderId: string) {
  if (!UUID_RE.test(orderId)) throw new AppError("order_not_found");
  const [row] = await asService((q) =>
    q.query<{ data: { revoked: boolean; points: number } }>("select public.revoke_order_points($1::uuid) as data", [orderId]),
  );
  return row.data;
}

/** ポイント残高（台帳 points_transactions の合計） */
export async function getPointsBalance(userId: string) {
  const [row] = await asUser(userId, (q) =>
    q.query<{ balance: number }>("select public.points_balance($1::uuid) as balance", [userId]),
  );
  return Number(row?.balance ?? 0);
}
