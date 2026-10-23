import "server-only";
import { asService } from "../db";

/**
 * 利用者に表示する運用ルールの値（キャンセル可能時間など）。表示も DB（platform_settings）の値を使い、コードに埋め込まない。
 */
export type PolicySettings = {
  userRefundWindowMinutes: number;
  tsunaguChargeYen: number;
  orderPoints: number;
  paymentHoldMinutes: number;
  pickupEarlyGraceMinutes: number;
  pickupLateGraceMinutes: number;
};

export async function getPolicySettings(): Promise<PolicySettings> {
  const rows = await asService((q) => q.query<{ key: string; int_value: number }>("select key, int_value from public.platform_settings"));
  const v = new Map(rows.map((r) => [r.key, Number(r.int_value)]));
  const get = (key: string) => {
    const value = v.get(key);
    if (value === undefined) throw new Error(`platform_settings.${key} is missing`);
    return value;
  };
  return {
    userRefundWindowMinutes: get("user_refund_window_minutes"),
    tsunaguChargeYen: get("tsunagu_charge_yen"),
    orderPoints: get("order_points"),
    paymentHoldMinutes: get("payment_hold_minutes"),
    pickupEarlyGraceMinutes: get("pickup_early_grace_minutes"),
    pickupLateGraceMinutes: get("pickup_late_grace_minutes"),
  };
}

/** 購入確認などに出す短いキャンセルポリシー */
export function cancellationSummary(s: Pick<PolicySettings, "userRefundWindowMinutes">) {
  return `決済後${s.userRefundWindowMinutes}分以内かつ受取開始前までキャンセル可能です。`;
}
