import "server-only";
import { AppError } from "@/lib/errors";
import { groupRelistSources, resolvePrices, type QuickRelistInput, type RelistSourceRow } from "@/lib/quick-relist";
import type { ProductForm } from "@/lib/validation";
import { asUser } from "../db";
import { createProduct } from "./store";

/**
 * かんたん出品（過去の商品をもう一度出品）。店舗メンバー（オーナー・スタッフ）の権限（RLS）で、自店舗の商品だけを読む。
 * 過去の商品・注文は変更せず、新しい商品として作成する（数量・受取日時は今回の入力だけを使う）。
 */
const COLUMNS = `p.id, p.name, p.image_url, p.rescue_price, p.original_price, p.is_box, p.category, p.description, p.quantity,
  p.pickup_start_at, p.pickup_end_at, p.created_at`;

function toRow(r: Record<string, unknown>): RelistSourceRow {
  return {
    id: String(r.id),
    name: String(r.name),
    imageUrl: (r.image_url as string | null) ?? null,
    rescuePrice: Number(r.rescue_price),
    originalPrice: Number(r.original_price),
    isBox: Boolean(r.is_box),
    category: String(r.category),
    description: String(r.description ?? ""),
    quantity: Number(r.quantity),
    pickupStartAt: new Date(r.pickup_start_at as string).toISOString(),
    pickupEndAt: new Date(r.pickup_end_at as string).toISOString(),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

/** 過去の商品（最新利用順）と「いつもの商品」 */
export async function listRelistSources(userId: string, storeId: string, now = new Date()) {
  const rows = await asUser(userId, (q) =>
    q.query<Record<string, unknown>>(
      `select ${COLUMNS} from public.products p
       where p.store_id = $1 and p.deleted_at is null
       order by p.created_at desc limit 300`,
      [storeId],
    ),
  );
  return groupRelistSources(rows.map(toRow), now);
}

/** 自店舗の商品だけ（他店舗の商品 ID なら null） */
export async function getRelistSource(userId: string, storeId: string, productId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return null;
  const [row] = await asUser(userId, (q) =>
    q.query<Record<string, unknown>>(
      `select ${COLUMNS} from public.products p where p.id = $1 and p.store_id = $2 and p.deleted_at is null`,
      [productId, storeId],
    ),
  );
  return row ? toRow(row) : null;
}

/** 過去の商品の内容 + 今回の数量・受取日時で、新しい商品として出品する */
export async function quickRelist(userId: string, storeId: string, input: QuickRelistInput, now = new Date()) {
  const source = await getRelistSource(userId, storeId, input.sourceId);
  if (!source) throw new AppError("product_not_found");
  const prices = resolvePrices(source, input);
  if (!prices.ok) throw new AppError("validation", prices.message);
  const form: ProductForm = {
    name: source.name,
    description: source.description,
    category: source.category as ProductForm["category"],
    isBox: source.isBox,
    originalPrice: prices.originalPrice,
    rescuePrice: prices.rescuePrice,
    quantity: input.quantity,
    pickupDate: input.pickupDate,
    pickupStart: input.pickupStart,
    pickupEnd: input.pickupEnd,
    imageUrl: source.imageUrl ?? "",
    templateId: "",
    saveTemplate: false,
  };
  return createProduct(userId, storeId, form, now);
}
