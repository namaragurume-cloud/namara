/**
 * v2 注文（orders）の状態と運用ルール。
 *
 * 状態遷移（DB トリガー public.orders_guard と同じ。tests/orders.test.ts で一致を確認）
 *   pending_payment → paid → picked_up
 *                          → unclaimed（受取時間を過ぎても受取完了がない。売上は確定のまま）
 *                          → refunded
 *   pending_payment → cancelled（決済期限切れ・ユーザーの中断）
 * picked_up / unclaimed / cancelled / refunded は終端。決済完了（paid）と受取完了（picked_up）は別に記録する。
 *
 * ORDER_POLICY の値は public.platform_settings にも同じ値を入れている（tests/pricing-sync.test.ts）。
 */
export const ORDER_STATUSES = ["pending_payment", "paid", "picked_up", "unclaimed", "cancelled", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["picked_up", "unclaimed", "refunded"],
  picked_up: [],
  unclaimed: [],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return ORDER_TRANSITIONS[from].includes(to);
}

export const ORDER_POLICY = {
  /** 決済待ち（在庫の仮押さえ）の有効期限。受取終了時刻を超えることはない */
  paymentHoldMinutes: 15,
  /** ユーザー都合で全額返金できるのは、決済完了から何分以内か（かつ受取開始前） */
  userRefundWindowMinutes: 5,
  /** 1人が同時に持てる決済待ちの注文数 */
  maxPendingOrdersPerUser: 3,
} as const;
