import "server-only";
import { asService } from "../db";

export type EventName =
  | "product_view"
  | "reservation_created"
  | "reservation_cancelled"
  | "qr_checkin"
  | "reservation_completed"
  | "no_show"
  | "favorite_store"
  | "unfavorite_store"
  | "ai_description_generated"
  | "product_published"
  | "login"
  | "pickup_ticket_viewed"
  | "pickup_swipe_started"
  | "monitor_opened"
  | "monitor_sound_enabled"
  | "monitor_fullscreen_enabled"
  | "my_page_viewed"
  | "orders_viewed"
  | "points_history_viewed"
  | "store_dashboard_viewed"
  | "store_onboarding_viewed";

/** 分析イベントを記録する。失敗しても本処理は止めない。 */
export async function logEvent(
  name: EventName,
  data: { userId?: string | null; storeId?: string | null; productId?: string | null; reservationId?: string | null; properties?: Record<string, unknown> } = {},
) {
  try {
    await asService((q) =>
      q.query(
        `insert into public.events (name, user_id, store_id, product_id, reservation_id, properties)
         values ($1, $2, $3, $4, $5, $6::jsonb)`,
        [name, data.userId ?? null, data.storeId ?? null, data.productId ?? null, data.reservationId ?? null, JSON.stringify(data.properties ?? {})],
      ),
    );
  } catch (error) {
    console.error("[event] failed", name, error);
  }
}
