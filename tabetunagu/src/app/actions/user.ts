"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { notificationSettingsSchema } from "@/lib/validation";
import { getViewer } from "@/server/auth/viewer";
import { checkinWithToken } from "@/server/services/checkin";
import { logEvent } from "@/server/services/events";
import { cancelReservation, createReservation, setFavorite, updateNotificationSettings } from "@/server/services/reservations";
import { toActionError, type ActionState } from "./state";

const CHECKIN_MESSAGES: Record<string, string> = {
  invalid_token: "このQRコードは確認できませんでした。お手数ですが、店舗スタッフにお声がけください。",
  store_inactive: "この店舗は現在、受付を停止しています。",
  no_reservation: "この店舗での有効な予約が見つかりません。予約したお店のQRか、ご確認ください。",
  too_early: "受取開始の30分前からチェックインできます。もう少しお待ちください。",
  window_closed: "受取時間が終了しているため、チェックインできません。",
  already_completed: "この予約はすでに食べつなぎ完了しています。",
  cancelled: "この予約はキャンセル済みです。",
};

export async function reserveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get("productId") ?? "");
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/products/${productId}/reserve`)}`);
  const quantity = Number(formData.get("quantity") ?? 1);
  let reservationId: string;
  try {
    reservationId = (await createReservation(viewer.id, productId, quantity)).id;
  } catch (error) {
    return toActionError(error);
  }
  redirect(`/reservations/${reservationId}?new=1`);
}

export async function cancelReservationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const reservationId = String(formData.get("reservationId") ?? "");
  try {
    await cancelReservation(viewer.id, reservationId);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "予約をキャンセルしました。" };
}

export async function checkinAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/c/${token}`)}`);
  let result: Awaited<ReturnType<typeof checkinWithToken>>;
  try {
    result = await checkinWithToken(viewer.id, token);
  } catch (error) {
    return toActionError(error);
  }
  if (result.result === "success") redirect(`/done/${result.reservationIds[0]}`);
  return {
    ok: false,
    code: result.result,
    message: CHECKIN_MESSAGES[result.result],
    data: { reservationId: result.reservationId ?? null, pickupStartAt: result.pickupStartAt ?? null },
  };
}

export async function toggleFavoriteAction(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const favorite = formData.get("favorite") === "1";
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(String(formData.get("next") ?? "/"))}`);
  await setFavorite(viewer.id, storeId, favorite);
  await logEvent(favorite ? "favorite_store" : "unfavorite_store", { userId: viewer.id, storeId });
  refresh();
}

export async function updateNotificationsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/me");
  const parsed = notificationSettingsSchema.safeParse({
    notifyEnabled: formData.get("notifyEnabled") ?? "",
    notifyAreas: formData.getAll("notifyAreas").map(String),
  });
  if (!parsed.success) return { ok: false, message: "入力内容をご確認ください。" };
  try {
    await updateNotificationSettings(viewer.id, parsed.data.notifyEnabled, parsed.data.notifyAreas);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "通知設定を保存しました。" };
}
