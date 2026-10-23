"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { assertStoreMember, getViewer } from "@/server/auth/viewer";
import { logEvent } from "@/server/services/events";
import { storeRefundOrder } from "@/server/services/payments";
import { pickupOrder } from "@/server/services/pickup";
import { toActionError, type ActionState } from "./state";

/** 受取完了（ユーザー本人のスワイプ）。IP・User-Agent は不正分析のため受取イベントにだけ残す */
export async function pickupOrderAction(orderId: string, swipeMs: number): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "ログインしてください。", code: "not_authenticated" };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || null;
  try {
    const result = await pickupOrder(viewer.id, orderId, { ip, userAgent: h.get("user-agent"), swipeMs });
    refresh();
    return { ok: true, code: result.result };
  } catch (error) {
    return toActionError(error);
  }
}

/** スワイプ開始（分析用。個人情報は残さない） */
export async function pickupSwipeStartedAction(orderId: string): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) return;
  await logEvent("pickup_swipe_started", { userId: viewer.id, properties: { order_id: orderId } });
}

/** 店舗都合のキャンセル・全額返金（店舗メンバー。理由必須。在庫は戻さない） */
export async function storeRefundOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const storeId = String(formData.get("storeId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "キャンセル理由を入力してください。", code: "reason_required" };
  try {
    const { viewer } = await assertStoreMember(storeId);
    await storeRefundOrder(viewer.id, orderId, reason.slice(0, 200));
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "キャンセルし、全額を返金しました。" };
}
