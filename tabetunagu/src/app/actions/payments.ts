"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { features } from "@/lib/features";
import { assertStoreMember, getViewer } from "@/server/auth/viewer";
import { startConnectOnboarding } from "@/server/services/connect";
import { cancelPendingOrder } from "@/server/services/orders";
import { purchase, requestUserRefund, startCheckout } from "@/server/services/payments";
import { toActionError, type ActionState } from "./state";

/** 購入を確定 → 注文（決済待ち）を作成 → Stripe Checkout へ */
export async function purchaseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get("productId") ?? "");
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/products/${productId}/buy`)}`);
  if (!features.v2CheckoutOpen) return { ok: false, message: "現在オンラインでの購入は準備中です。", code: "v2_checkout_closed" };
  const quantity = Number(formData.get("quantity") ?? 1);
  let url: string;
  try {
    url = (await purchase(viewer.id, productId, quantity)).url;
  } catch (error) {
    return toActionError(error);
  }
  redirect(url);
}

/** 決済待ちの注文のお支払いへ進む（有効な Checkout Session があれば再利用） */
export async function resumeCheckoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = String(formData.get("orderId") ?? "");
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/orders/${orderId}`)}`);
  if (!features.v2CheckoutOpen) return { ok: false, message: "現在オンラインでの購入は準備中です。", code: "v2_checkout_closed" };
  let url: string;
  try {
    url = await startCheckout(viewer.id, orderId);
  } catch (error) {
    return toActionError(error);
  }
  redirect(url);
}

/** 決済前の注文をやめる（在庫を戻す） */
export async function cancelPendingOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = String(formData.get("orderId") ?? "");
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  try {
    await cancelPendingOrder(viewer.id, orderId);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "注文を取り消しました。" };
}

/** お客様都合のキャンセル・全額返金 */
export async function requestRefundAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = String(formData.get("orderId") ?? "");
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  try {
    await requestUserRefund(viewer.id, orderId);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "キャンセルし、全額を返金しました。" };
}

/** 売上受取設定（Stripe Connect）の開始・再開。オーナーのみ */
export async function startConnectOnboardingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const storeId = String(formData.get("storeId") ?? "");
  let url: string;
  try {
    const { viewer } = await assertStoreMember(storeId, { owner: true });
    url = await startConnectOnboarding(viewer.id, storeId);
  } catch (error) {
    return toActionError(error);
  }
  redirect(url);
}
