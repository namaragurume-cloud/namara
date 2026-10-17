import "server-only";
import type { ProductCard, ReservationView, StoreInfo } from "@/lib/types";

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : new Date(String(v)).toISOString());
export const isoOrNull = iso;
export const isoStr = (v: unknown) => iso(v) ?? new Date(0).toISOString();

/** products p + stores s を結合したクエリで使う列 */
export const PRODUCT_CARD_COLUMNS = `
  p.id, p.name, p.description, p.image_url, p.category::text as category, p.is_box,
  p.original_price, p.rescue_price, p.quantity, p.remaining_quantity, p.max_per_reservation,
  p.pickup_start_at, p.pickup_end_at, p.status::text as status,
  s.id as store_id, s.name as store_name, s.slug as store_slug, s.area_id, s.plan_code`;

export function toProductCard(r: Record<string, unknown>): ProductCard {
  return {
    id: String(r.id),
    name: String(r.name),
    description: String(r.description ?? ""),
    imageUrl: (r.image_url as string | null) ?? null,
    category: String(r.category),
    isBox: Boolean(r.is_box),
    originalPrice: Number(r.original_price),
    rescuePrice: Number(r.rescue_price),
    quantity: Number(r.quantity),
    remaining: Number(r.remaining_quantity),
    maxPerReservation: Number(r.max_per_reservation ?? 3),
    pickupStartAt: isoStr(r.pickup_start_at),
    pickupEndAt: isoStr(r.pickup_end_at),
    status: r.status as ProductCard["status"],
    storeId: String(r.store_id),
    storeName: String(r.store_name),
    storeSlug: String(r.store_slug),
    areaId: String(r.area_id),
    plan: r.plan_code === "standard" ? "standard" : "free",
  };
}

export const STORE_COLUMNS = `
  s.id, s.slug, s.name, s.category::text as category, s.area_id, s.address, s.phone, s.description,
  s.opening_hours, s.pickup_note, s.image_url, s.status::text as status, s.plan_code`;

export function toStoreInfo(r: Record<string, unknown>): StoreInfo {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    category: String(r.category),
    areaId: String(r.area_id),
    address: String(r.address ?? ""),
    phone: String(r.phone ?? ""),
    description: String(r.description ?? ""),
    openingHours: String(r.opening_hours ?? ""),
    pickupNote: String(r.pickup_note ?? ""),
    imageUrl: (r.image_url as string | null) ?? null,
    status: r.status as StoreInfo["status"],
    plan: r.plan_code === "standard" ? "standard" : "free",
  };
}

export const RESERVATION_COLUMNS = `
  r.id, r.code, r.status::text as status, r.quantity, r.unit_price, r.total_price,
  r.pickup_start_at, r.pickup_end_at, r.created_at, r.completed_at, r.cancelled_at,
  r.cancelled_by::text as cancelled_by, r.cancel_reason,
  p.id as product_id, p.name as product_name, p.image_url as product_image_url,
  p.category::text as category, p.is_box, p.estimated_weight_g,
  s.id as store_id, s.name as store_name, s.slug as store_slug, s.address as store_address,
  s.pickup_note as store_pickup_note, s.area_id`;

export function toReservationView(r: Record<string, unknown>): ReservationView {
  return {
    id: String(r.id),
    code: String(r.code),
    status: r.status as ReservationView["status"],
    quantity: Number(r.quantity),
    unitPrice: Number(r.unit_price),
    totalPrice: Number(r.total_price),
    pickupStartAt: isoStr(r.pickup_start_at),
    pickupEndAt: isoStr(r.pickup_end_at),
    createdAt: isoStr(r.created_at),
    completedAt: iso(r.completed_at),
    cancelledAt: iso(r.cancelled_at),
    cancelledBy: (r.cancelled_by as string | null) ?? null,
    cancelReason: (r.cancel_reason as string | null) ?? null,
    productId: String(r.product_id),
    productName: String(r.product_name),
    productImageUrl: (r.product_image_url as string | null) ?? null,
    category: String(r.category),
    isBox: Boolean(r.is_box),
    estimatedWeightG: Number(r.estimated_weight_g ?? 0),
    storeId: String(r.store_id),
    storeName: String(r.store_name),
    storeSlug: String(r.store_slug),
    storeAddress: String(r.store_address ?? ""),
    storePickupNote: String(r.store_pickup_note ?? ""),
    areaId: String(r.area_id),
  };
}
