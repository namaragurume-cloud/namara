import "server-only";
import { AppError } from "@/lib/errors";
import { asService, asUser } from "../db";
import { verifyStoreQrToken } from "../qr";
import { RESERVATION_COLUMNS, toReservationView } from "./mappers";

export type CheckinResult =
  | { result: "success"; storeName: string; reservationIds: string[]; pointsAwarded: number }
  | {
      result:
        | "invalid_token"
        | "store_inactive"
        | "no_reservation"
        | "too_early"
        | "window_closed"
        | "already_completed"
        | "cancelled";
      storeName?: string;
      reservationId?: string | null;
      pickupStartAt?: string | null;
    };

/** QR の店舗情報と、その店舗でのこのユーザーの有効な予約（確認画面用） */
export async function previewCheckin(userId: string, token: string) {
  const parsed = verifyStoreQrToken(token);
  if (!parsed) return null;
  const [store] = await asService((q) =>
    q.query<{ id: string; name: string; status: string; qr_version: number; area_id: string }>(
      "select id, name, status::text, qr_version, area_id from public.stores where id = $1",
      [parsed.storeId],
    ),
  );
  if (!store || store.qr_version !== parsed.version) return null;
  const reservations = (
    await asUser(userId, (q) =>
      q.query(
        `select ${RESERVATION_COLUMNS}
         from public.reservations r
         join public.products p on p.id = r.product_id
         join public.stores s on s.id = r.store_id
         where r.user_id = $1 and r.store_id = $2 and r.status in ('pending', 'confirmed')
         order by r.pickup_start_at`,
        [userId, store.id],
      ),
    )
  ).map(toReservationView);
  return { store: { id: store.id, name: store.name, active: store.status === "active" }, reservations };
}

/**
 * QR チェックイン。トークンの署名をサーバーで検証してから DB 関数で照合・完了処理する。
 * 照合（ログイン・有効な予約・受取時間・完了済み・キャンセル済み）は DB 関数側で行い、失敗も記録される。
 */
export async function checkinWithToken(userId: string, token: string): Promise<CheckinResult> {
  const parsed = verifyStoreQrToken(token);
  if (!parsed) {
    // 改ざん・偽造されたトークン。店舗が特定できないので記録だけ残す
    await asService((q) =>
      q.query("insert into public.checkins (user_id, result) values ($1, 'invalid_token')", [userId]),
    ).catch(() => {});
    return { result: "invalid_token" };
  }
  const [row] = await asUser(userId, (q) =>
    q.query<{ data: Record<string, unknown> }>("select public.checkin_store($1::uuid, $2::int) as data", [
      parsed.storeId,
      parsed.version,
    ]),
  );
  const data = row?.data;
  if (!data || typeof data.result !== "string") throw new AppError("unknown");
  if (data.result === "success") {
    return {
      result: "success",
      storeName: String(data.store_name ?? ""),
      reservationIds: (data.reservation_ids as string[]) ?? [],
      pointsAwarded: Number(data.points_awarded ?? 0),
    };
  }
  return {
    result: data.result as Exclude<CheckinResult["result"], "success">,
    storeName: data.store_name ? String(data.store_name) : undefined,
    reservationId: (data.reservation_id as string | null) ?? null,
    pickupStartAt: (data.pickup_start_at as string | null) ?? null,
  };
}
