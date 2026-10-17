import "server-only";
import { areaDistance } from "@/lib/categories";
import type { ProductCard, StoreInfo } from "@/lib/types";
import { asViewer } from "../db";
import { PRODUCT_CARD_COLUMNS, STORE_COLUMNS, toProductCard, toStoreInfo } from "./mappers";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CatalogSort = "recommended" | "nearby" | "ending" | "price";
export type CatalogTime = "now" | "before19" | "after19";

export type CatalogFilters = {
  area?: string;
  category?: string;
  time?: CatalogTime;
  sort?: CatalogSort;
};

/** 受付中の商品（稼働店舗・公開中・受取終了前）。RLS が効く viewer 権限で読む。 */
export async function listAvailableProducts(viewerId: string | null, filters: CatalogFilters = {}, now = new Date()) {
  const rows = await asViewer(viewerId, (q) =>
    q.query(
      `select ${PRODUCT_CARD_COLUMNS}
       from public.products p
       join public.stores s on s.id = p.store_id
       where p.deleted_at is null
         and p.status in ('published', 'sold_out')
         and s.status = 'active'
         and p.pickup_end_at > $1
         and ($2::text is null or s.area_id = $2)
         and ($3::text is null or p.category::text = $3)`,
      [now.toISOString(), filters.area || null, filters.category || null],
    ),
  );
  let items = rows.map(toProductCard);
  items = filterByTime(items, filters.time, now);
  return sortProducts(items, filters.sort ?? "recommended", filters.area, now);
}

function jstClock(now: Date, hhmm: string) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(now);
  return new Date(`${day}T${hhmm}:00+09:00`).getTime();
}

export function filterByTime(items: ProductCard[], time: CatalogTime | undefined, now: Date) {
  if (!time) return items;
  const t19 = jstClock(now, "19:00");
  return items.filter((p) => {
    const start = Date.parse(p.pickupStartAt);
    const end = Date.parse(p.pickupEndAt);
    if (time === "now") return start <= now.getTime() && end > now.getTime();
    if (time === "before19") return start < t19;
    return end > t19;
  });
}

/** おすすめ: 受付中 → STANDARD の優先掲載 → お得度 → 終了が近い順 */
export function sortProducts(items: ProductCard[], sort: CatalogSort, area: string | undefined, now: Date) {
  const available = (p: ProductCard) => (p.status === "published" && p.remaining > 0 ? 0 : 1);
  const discount = (p: ProductCard) => 1 - p.rescuePrice / p.originalPrice;
  const byEnd = (a: ProductCard, b: ProductCard) => Date.parse(a.pickupEndAt) - Date.parse(b.pickupEndAt);
  const recommended = (a: ProductCard, b: ProductCard) =>
    available(a) - available(b) ||
    (a.plan === "standard" ? 0 : 1) - (b.plan === "standard" ? 0 : 1) ||
    // 受取開始済みのものを先に（今すぐ受け取れる）
    (Date.parse(a.pickupStartAt) <= now.getTime() ? 0 : 1) - (Date.parse(b.pickupStartAt) <= now.getTime() ? 0 : 1) ||
    discount(b) - discount(a) ||
    byEnd(a, b);
  const sorted = [...items];
  switch (sort) {
    case "ending":
      sorted.sort((a, b) => available(a) - available(b) || byEnd(a, b));
      break;
    case "price":
      sorted.sort((a, b) => available(a) - available(b) || a.rescuePrice - b.rescuePrice || byEnd(a, b));
      break;
    case "nearby":
      sorted.sort(
        (a, b) =>
          available(a) - available(b) ||
          (area ? areaDistance(area, a.areaId) - areaDistance(area, b.areaId) : 0) ||
          recommended(a, b),
      );
      break;
    default:
      sorted.sort(recommended);
  }
  return sorted;
}

export async function getProductDetail(viewerId: string | null, productId: string) {
  if (!UUID_RE.test(productId)) return null;
  return asViewer(viewerId, async (q) => {
    const [row] = await q.query(
      `select ${PRODUCT_CARD_COLUMNS}
       from public.products p join public.stores s on s.id = p.store_id
       where p.id = $1 and p.deleted_at is null`,
      [productId],
    );
    if (!row) return null;
    const product = toProductCard(row);
    const [storeRow] = await q.query(`select ${STORE_COLUMNS} from public.stores s where s.id = $1`, [product.storeId]);
    if (!storeRow) return null;
    const store = toStoreInfo(storeRow);
    let myReservationId: string | null = null;
    let isFavorite = false;
    if (viewerId) {
      const [res] = await q.query<{ id: string }>(
        `select id from public.reservations
         where product_id = $1 and user_id = $2 and status in ('pending', 'confirmed') limit 1`,
        [productId, viewerId],
      );
      myReservationId = res?.id ?? null;
      const [fav] = await q.query(`select 1 from public.favorites where user_id = $1 and store_id = $2`, [viewerId, store.id]);
      isFavorite = Boolean(fav);
    }
    return { product, store, myReservationId, isFavorite };
  });
}

export async function getStorePage(viewerId: string | null, slug: string, now = new Date()) {
  return asViewer(viewerId, async (q) => {
    const [row] = await q.query(`select ${STORE_COLUMNS} from public.stores s where s.slug = $1 and s.status = 'active'`, [slug]);
    if (!row) return null;
    const store: StoreInfo = toStoreInfo(row);
    const products = (
      await q.query(
        `select ${PRODUCT_CARD_COLUMNS} from public.products p join public.stores s on s.id = p.store_id
         where p.store_id = $1 and p.deleted_at is null and p.status in ('published', 'sold_out') and p.pickup_end_at > $2
         order by p.pickup_start_at`,
        [store.id, now.toISOString()],
      )
    ).map(toProductCard);
    let isFavorite = false;
    if (viewerId) {
      const [fav] = await q.query(`select 1 from public.favorites where user_id = $1 and store_id = $2`, [viewerId, store.id]);
      isFavorite = Boolean(fav);
    }
    return { store, products, isFavorite };
  });
}

/** エリアごとの受付中件数（ホーム・まとめ通知と同じ数え方） */
export function countByArea(items: ProductCard[]) {
  const counts = new Map<string, number>();
  for (const p of items) {
    if (p.status !== "published" || p.remaining <= 0) continue;
    counts.set(p.areaId, (counts.get(p.areaId) ?? 0) + 1);
  }
  return counts;
}
