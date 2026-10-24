import "server-only";
import { estimatedWeightG } from "@/lib/categories";
import { AppError } from "@/lib/errors";
import { calcMonthlyFeeFromCompletions, type PlanCode } from "@/lib/fees";
import { ymd } from "@/lib/format";
import { jstHour, jstMonthRange, pickupWindow, startOfJstDay } from "@/lib/time";
import type { ProductForm } from "@/lib/validation";
import { asUser, type Queryable } from "../db";
import { isoOrNull, isoStr, STORE_COLUMNS, toStoreInfo } from "./mappers";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86_400_000;

export type StoreProductRow = {
  id: string;
  name: string;
  status: string;
  category: string;
  isBox: boolean;
  imageUrl: string | null;
  quantity: number;
  remaining: number;
  originalPrice: number;
  rescuePrice: number;
  pickupStartAt: string;
  pickupEndAt: string;
  activeCount: number;
  completedCount: number;
  completedQty: number;
  cancelledCount: number;
};

const STORE_PRODUCT_SQL = `
  select p.id, p.name, p.status::text as status, p.category::text as category, p.is_box, p.image_url,
         p.quantity, p.remaining_quantity, p.original_price, p.rescue_price, p.pickup_start_at, p.pickup_end_at,
         count(r.id) filter (where r.status in ('pending', 'confirmed'))::int as active_count,
         count(r.id) filter (where r.status = 'completed')::int as completed_count,
         coalesce(sum(r.quantity) filter (where r.status = 'completed'), 0)::int as completed_qty,
         count(r.id) filter (where r.status = 'cancelled')::int as cancelled_count
  from public.products p
  left join public.reservations r on r.product_id = p.id`;

function toStoreProduct(r: Record<string, unknown>): StoreProductRow {
  return {
    id: String(r.id),
    name: String(r.name),
    status: String(r.status),
    category: String(r.category),
    isBox: Boolean(r.is_box),
    imageUrl: (r.image_url as string | null) ?? null,
    quantity: Number(r.quantity),
    remaining: Number(r.remaining_quantity),
    originalPrice: Number(r.original_price),
    rescuePrice: Number(r.rescue_price),
    pickupStartAt: isoStr(r.pickup_start_at),
    pickupEndAt: isoStr(r.pickup_end_at),
    activeCount: Number(r.active_count),
    completedCount: Number(r.completed_count),
    completedQty: Number(r.completed_qty),
    cancelledCount: Number(r.cancelled_count),
  };
}

export type TemplateRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  isBox: boolean;
  imageUrl: string | null;
  originalPrice: number;
  rescuePrice: number;
  quantity: number;
  pickupStart: string;
  pickupEnd: string;
  autoRelist: boolean;
  autoRelistWeekdays: number[];
  lastListedOn: string | null;
};

async function loadTemplates(q: Queryable, storeId: string): Promise<TemplateRow[]> {
  const rows = await q.query(
    `select id, name, description, category::text as category, is_box, image_url, original_price, rescue_price, quantity,
            to_char(pickup_start_time, 'HH24:MI') as pickup_start, to_char(pickup_end_time, 'HH24:MI') as pickup_end,
            auto_relist, auto_relist_weekdays, to_char(last_listed_on, 'YYYY-MM-DD') as last_listed_on
     from public.product_templates where store_id = $1 order by created_at`,
    [storeId],
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    description: String(r.description),
    category: String(r.category),
    isBox: Boolean(r.is_box),
    imageUrl: (r.image_url as string | null) ?? null,
    originalPrice: Number(r.original_price),
    rescuePrice: Number(r.rescue_price),
    quantity: Number(r.quantity),
    pickupStart: String(r.pickup_start),
    pickupEnd: String(r.pickup_end),
    autoRelist: Boolean(r.auto_relist),
    autoRelistWeekdays: ((r.auto_relist_weekdays as number[]) ?? []).map(Number),
    lastListedOn: (r.last_listed_on as string | null) ?? null,
  }));
}

/** QR完了率の分母: 完了 + No Show + 受取時間 + 猶予を過ぎても未チェックイン（バッチ未実行分も含める） */
const RESOLVED_FILTER = `(status in ('completed', 'no_show') or (status in ('pending', 'confirmed') and pickup_end_at + interval '30 minutes' < now()))`;

export async function getStoreDashboard(userId: string, storeId: string, now = new Date()) {
  const dayStart = startOfJstDay(now);
  const dayEnd = new Date(dayStart.getTime() + DAY);
  const month = jstMonthRange(ymd(now).slice(0, 7));
  return asUser(userId, async (q) => {
    const [storeRow] = await q.query(`select ${STORE_COLUMNS} from public.stores s where s.id = $1`, [storeId]);
    if (!storeRow) throw new AppError("forbidden");
    const store = toStoreInfo(storeRow);

    const todayProducts = (
      await q.query(
        `${STORE_PRODUCT_SQL}
         where p.store_id = $1 and p.deleted_at is null and p.pickup_start_at < $3 and p.pickup_end_at >= $2
         group by p.id order by p.pickup_start_at`,
        [storeId, dayStart.toISOString(), dayEnd.toISOString()],
      )
    ).map(toStoreProduct);

    const [today] = await q.query<{ reserved: number; completed: number; cancelled: number; waiting: number }>(
      `select count(*) filter (where status <> 'cancelled')::int as reserved,
              count(*) filter (where status = 'completed')::int as completed,
              count(*) filter (where status = 'cancelled')::int as cancelled,
              count(*) filter (where status in ('pending', 'confirmed'))::int as waiting
       from public.reservations where store_id = $1 and pickup_start_at >= $2 and pickup_start_at < $3`,
      [storeId, dayStart.toISOString(), dayEnd.toISOString()],
    );

    const completions = await q.query<{ total_price: number; commission_rate: number | null; plan_code: string | null }>(
      `select total_price, commission_rate::float8 as commission_rate, plan_code
       from public.reservations
       where store_id = $1 and status = 'completed' and completed_at >= $2 and completed_at < $3`,
      [storeId, month.start.toISOString(), month.end.toISOString()],
    );
    const [rate] = await q.query<{ completed: number; resolved: number; no_show: number }>(
      `select count(*) filter (where status = 'completed')::int as completed,
              count(*) filter (where ${RESOLVED_FILTER})::int as resolved,
              count(*) filter (where ${RESOLVED_FILTER} and status <> 'completed')::int as no_show
       from public.reservations
       where store_id = $1 and pickup_start_at >= $2 and pickup_start_at < $3`,
      [storeId, month.start.toISOString(), month.end.toISOString()],
    );

    const [lastRow] = await q.query<{ id: string; name: string; pickup_start_at: Date | string }>(
      `select id, name, pickup_start_at from public.products where store_id = $1 and deleted_at is null order by created_at desc limit 1`,
      [storeId],
    );
    // 直近の商品の受取日が昨日なら「昨日と同じ商品を出品」
    const last = lastRow
      ? { id: lastRow.id, name: lastRow.name, yesterday: ymd(new Date(lastRow.pickup_start_at)) === ymd(new Date(now.getTime() - DAY)) }
      : null;
    const [favorites] = await q.query<{ count: number }>(
      "select count(*)::int as count from public.favorites where store_id = $1",
      [storeId],
    );

    const fee = calcMonthlyFeeFromCompletions(
      store.plan,
      completions.map((c) => ({ totalPrice: Number(c.total_price), commissionRate: c.commission_rate, planCode: c.plan_code })),
    );
    return {
      store,
      todayProducts,
      today: {
        listings: todayProducts.length,
        remaining: todayProducts
          .filter((p) => p.status === "published" || p.status === "sold_out")
          .reduce((s, p) => s + p.remaining, 0),
        reserved: today?.reserved ?? 0,
        completed: today?.completed ?? 0,
        cancelled: today?.cancelled ?? 0,
        waiting: today?.waiting ?? 0,
      },
      month: {
        label: month.month,
        completedCount: completions.length,
        qrRate: rate && rate.resolved > 0 ? rate.completed / rate.resolved : null,
        noShow: rate?.no_show ?? 0,
        fee,
      },
      lastProduct: last ?? null,
      templates: await loadTemplates(q, storeId),
      favoriteCount: favorites?.count ?? 0,
    };
  });
}

export async function listStoreProducts(userId: string, storeId: string, scope: "active" | "past", now = new Date()) {
  const rows = await asUser(userId, (q) =>
    q.query(
      `${STORE_PRODUCT_SQL}
       where p.store_id = $1 and p.deleted_at is null and ${scope === "active" ? "p.pickup_end_at > $2" : "p.pickup_end_at <= $2"}
       group by p.id order by p.pickup_start_at ${scope === "active" ? "asc" : "desc"} limit 200`,
      [storeId, now.toISOString()],
    ),
  );
  return rows.map(toStoreProduct);
}

export async function getStoreProduct(userId: string, storeId: string, productId: string) {
  if (!UUID_RE.test(productId)) return null;
  const [row] = await asUser(userId, (q) =>
    q.query(
      `${STORE_PRODUCT_SQL}
       where p.store_id = $1 and p.id = $2 and p.deleted_at is null group by p.id`,
      [storeId, productId],
    ),
  );
  if (!row) return null;
  const [extra] = await asUser(userId, (q) =>
    q.query<{ description: string; template_id: string | null }>(
      "select description, template_id from public.products where id = $1",
      [productId],
    ),
  );
  return { ...toStoreProduct(row), description: extra?.description ?? "", templateId: extra?.template_id ?? null };
}

export async function getTemplate(userId: string, storeId: string, templateId: string) {
  if (!UUID_RE.test(templateId)) return null;
  return asUser(userId, async (q) => (await loadTemplates(q, storeId)).find((t) => t.id === templateId) ?? null);
}

export async function listTemplates(userId: string, storeId: string) {
  return asUser(userId, (q) => loadTemplates(q, storeId));
}

function assertPickupDate(date: string, now: Date) {
  const today = ymd(now);
  const tomorrow = ymd(new Date(now.getTime() + DAY));
  if (date !== today && date !== tomorrow) throw new AppError("validation", "受取日は今日か明日を選んでください。");
}

/** 出品（公開）。フォームの値はサーバー側で zod 検証済みのものを渡す。 */
export async function createProduct(userId: string, storeId: string, form: ProductForm, now = new Date()) {
  assertPickupDate(form.pickupDate, now);
  const window = pickupWindow(form.pickupDate, form.pickupStart, form.pickupEnd);
  if (window.end.getTime() <= now.getTime()) {
    throw new AppError("validation", "受取終了時刻が過ぎています。時刻を確認してください。");
  }
  return asUser(userId, async (q) => {
    let templateId = form.templateId || null;
    if (templateId) {
      const [own] = await q.query("select id from public.product_templates where id = $1 and store_id = $2", [templateId, storeId]);
      if (!own) templateId = null;
    }
    if (form.saveTemplate) {
      const values = [
        storeId,
        form.name,
        form.description,
        form.category,
        form.isBox,
        form.imageUrl || null,
        form.originalPrice,
        form.rescuePrice,
        form.quantity,
        form.pickupStart,
        form.pickupEnd,
      ];
      if (templateId) {
        await q.query(
          `update public.product_templates set name = $2, description = $3, category = $4, is_box = $5, image_url = $6,
             original_price = $7, rescue_price = $8, quantity = $9, pickup_start_time = $10::time, pickup_end_time = $11::time,
             last_listed_on = $13::date
           where store_id = $1 and id = $12`,
          [...values, templateId, form.pickupDate],
        );
      } else {
        const [t] = await q.query<{ id: string }>(
          `insert into public.product_templates (store_id, name, description, category, is_box, image_url, original_price,
             rescue_price, quantity, pickup_start_time, pickup_end_time, last_listed_on)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::time, $11::time, $12::date) returning id`,
          [...values, form.pickupDate],
        );
        templateId = t.id;
      }
    }
    const [row] = await q.query<{ id: string }>(
      `insert into public.products (store_id, template_id, name, description, image_url, category, is_box, original_price,
         rescue_price, quantity, estimated_weight_g, pickup_start_at, pickup_end_at, status, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'published', $14)
       returning id`,
      [
        storeId,
        templateId,
        form.name,
        form.description,
        form.imageUrl || null,
        form.category,
        form.isBox,
        form.originalPrice,
        form.rescuePrice,
        form.quantity,
        estimatedWeightG(form.category, form.isBox),
        window.start.toISOString(),
        window.end.toISOString(),
        userId,
      ],
    );
    return row.id;
  });
}

/** 「いつものBOXを出品」: テンプレートから今日の受取時間でワンタップ出品 */
export async function publishFromTemplate(userId: string, storeId: string, templateId: string, now = new Date()) {
  const template = await getTemplate(userId, storeId, templateId);
  if (!template) throw new AppError("product_not_found");
  return createProduct(
    userId,
    storeId,
    {
      name: template.name,
      description: template.description,
      category: template.category as ProductForm["category"],
      isBox: template.isBox,
      originalPrice: template.originalPrice,
      rescuePrice: template.rescuePrice,
      quantity: template.quantity,
      pickupDate: ymd(now),
      pickupStart: template.pickupStart,
      pickupEnd: template.pickupEnd,
      imageUrl: template.imageUrl ?? "",
      templateId: template.id,
      saveTemplate: true,
    },
    now,
  );
}

export async function setProductStatus(userId: string, storeId: string, productId: string, status: "published" | "closed") {
  if (!UUID_RE.test(productId)) throw new AppError("product_not_found");
  const rows = await asUser(userId, (q) =>
    q.query("update public.products set status = $3 where id = $2 and store_id = $1 returning id", [storeId, productId, status]),
  );
  if (rows.length === 0) throw new AppError("product_not_found");
}

export async function updateProductDetails(
  userId: string,
  storeId: string,
  productId: string,
  data: { name: string; description: string; rescuePrice: number; originalPrice: number },
) {
  if (data.rescuePrice > data.originalPrice) throw new AppError("validation", "食べつなぎ価格は通常価格以下にしてください。");
  const rows = await asUser(userId, (q) =>
    q.query(
      `update public.products set name = $3, description = $4, rescue_price = $5, original_price = $6
       where id = $2 and store_id = $1 returning id`,
      [storeId, productId, data.name, data.description, data.rescuePrice, data.originalPrice],
    ),
  );
  if (rows.length === 0) throw new AppError("product_not_found");
}

export async function adjustProductQuantity(userId: string, productId: string, quantity: number) {
  await asUser(userId, (q) => q.query("select id from public.adjust_product_quantity($1::uuid, $2::int)", [productId, quantity]));
}

export async function deleteProduct(userId: string, productId: string) {
  await asUser(userId, (q) => q.query("select public.delete_product($1::uuid)", [productId]));
}

export type StoreReservationRow = {
  id: string;
  code: string;
  status: string;
  quantity: number;
  totalPrice: number;
  pickupStartAt: string;
  pickupEndAt: string;
  completedAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  productName: string;
  userName: string;
};

export async function listStoreReservations(userId: string, storeId: string, date: string) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ymd();
  const start = new Date(`${day}T00:00:00+09:00`);
  const rows = await asUser(userId, (q) =>
    q.query(
      `select r.id, r.code, r.status::text as status, r.quantity, r.total_price, r.pickup_start_at, r.pickup_end_at,
              r.completed_at, r.cancelled_by::text as cancelled_by, r.cancel_reason, p.name as product_name,
              u.display_name as user_name
       from public.reservations r
       join public.products p on p.id = r.product_id
       left join public.users u on u.id = r.user_id
       where r.store_id = $1 and r.pickup_start_at >= $2 and r.pickup_start_at < $3
       order by r.pickup_start_at, r.created_at`,
      [storeId, start.toISOString(), new Date(start.getTime() + DAY).toISOString()],
    ),
  );
  return {
    date: day,
    rows: rows.map(
      (r): StoreReservationRow => ({
        id: String(r.id),
        code: String(r.code),
        status: String(r.status),
        quantity: Number(r.quantity),
        totalPrice: Number(r.total_price),
        pickupStartAt: isoStr(r.pickup_start_at),
        pickupEndAt: isoStr(r.pickup_end_at),
        completedAt: isoOrNull(r.completed_at),
        cancelledBy: (r.cancelled_by as string | null) ?? null,
        cancelReason: (r.cancel_reason as string | null) ?? null,
        productName: String(r.product_name),
        // 個人情報の最小化: 店舗には表示名の一部のみ見せる
        userName: maskName(String(r.user_name ?? "")),
      }),
    ),
  };
}

export function maskName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "お客様";
  const chars = Array.from(trimmed);
  return `${chars[0]}${"＊".repeat(Math.min(3, Math.max(1, chars.length - 1)))} 様`;
}

export async function storeCancelReservation(userId: string, reservationId: string, reason: string) {
  if (!UUID_RE.test(reservationId)) throw new AppError("reservation_not_found");
  await asUser(userId, (q) => q.query("select id from public.store_cancel_reservation($1::uuid, $2)", [reservationId, reason]));
}

export async function getStoreSales(userId: string, storeId: string, monthParam?: string) {
  const month = jstMonthRange(monthParam);
  return asUser(userId, async (q) => {
    const [storeRow] = await q.query(`select ${STORE_COLUMNS} from public.stores s where s.id = $1`, [storeId]);
    if (!storeRow) throw new AppError("forbidden");
    const store = toStoreInfo(storeRow);
    const rows = await q.query<{
      total_price: number;
      quantity: number;
      commission_rate: number | null;
      plan_code: string | null;
      completed_at: Date;
      product_name: string;
      category: string;
    }>(
      `select r.total_price, r.quantity, r.commission_rate::float8 as commission_rate, r.plan_code, r.completed_at,
              p.name as product_name, p.category::text as category
       from public.reservations r join public.products p on p.id = r.product_id
       where r.store_id = $1 and r.status = 'completed' and r.completed_at >= $2 and r.completed_at < $3`,
      [storeId, month.start.toISOString(), month.end.toISOString()],
    );
    const [counts] = await q.query<{ reserved: number; cancelled: number; no_show: number; completed: number; resolved: number }>(
      `select count(*)::int as reserved,
              count(*) filter (where status = 'cancelled')::int as cancelled,
              count(*) filter (where ${RESOLVED_FILTER} and status <> 'completed')::int as no_show,
              count(*) filter (where status = 'completed')::int as completed,
              count(*) filter (where ${RESOLVED_FILTER})::int as resolved
       from public.reservations where store_id = $1 and pickup_start_at >= $2 and pickup_start_at < $3`,
      [storeId, month.start.toISOString(), month.end.toISOString()],
    );
    const [listed] = await q.query<{ qty: number; listings: number }>(
      `select coalesce(sum(quantity), 0)::int as qty, count(*)::int as listings from public.products
       where store_id = $1 and deleted_at is null and pickup_start_at >= $2 and pickup_start_at < $3`,
      [storeId, month.start.toISOString(), month.end.toISOString()],
    );

    const fee = calcMonthlyFeeFromCompletions(
      store.plan as PlanCode,
      rows.map((r) => ({ totalPrice: Number(r.total_price), commissionRate: r.commission_rate, planCode: r.plan_code })),
    );

    const daily = new Map<string, { gmv: number; count: number }>();
    const hourly = Array.from({ length: 24 }, () => 0);
    const byProduct = new Map<string, { name: string; count: number; gmv: number }>();
    for (const r of rows) {
      const day = ymd(r.completed_at);
      const d = daily.get(day) ?? { gmv: 0, count: 0 };
      d.gmv += Number(r.total_price);
      d.count += 1;
      daily.set(day, d);
      hourly[jstHour(r.completed_at)] += 1;
      const p = byProduct.get(r.product_name) ?? { name: r.product_name, count: 0, gmv: 0 };
      p.count += Number(r.quantity);
      p.gmv += Number(r.total_price);
      byProduct.set(r.product_name, p);
    }
    const soldQty = rows.reduce((s, r) => s + Number(r.quantity), 0);
    return {
      store,
      month: month.month,
      fee,
      counts: {
        reserved: counts?.reserved ?? 0,
        cancelled: counts?.cancelled ?? 0,
        noShow: counts?.no_show ?? 0,
        completed: counts?.completed ?? 0,
        qrRate: counts && counts.resolved > 0 ? counts.completed / counts.resolved : null,
        listedQty: listed?.qty ?? 0,
        listings: listed?.listings ?? 0,
        sellThrough: listed && listed.qty > 0 ? soldQty / listed.qty : null,
      },
      daily: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v })),
      hourly,
      products: [...byProduct.values()].sort((a, b) => b.gmv - a.gmv).slice(0, 10),
    };
  });
}

export async function getStoreSettings(userId: string, storeId: string) {
  return asUser(userId, async (q) => {
    const [row] = await q.query(`select ${STORE_COLUMNS}, s.qr_version from public.stores s where s.id = $1`, [storeId]);
    if (!row) throw new AppError("forbidden");
    const members = await q.query<{ user_id: string; role: string; display_name: string | null }>(
      `select m.user_id, m.role::text as role, u.display_name
       from public.store_members m left join public.users u on u.id = m.user_id
       where m.store_id = $1 order by m.role, m.created_at`,
      [storeId],
    );
    const billing = await q.query<{ period_month: string; total_amount: number; status: string; gmv: number; commission_amount: number; monthly_fee: number }>(
      `select to_char(period_month, 'YYYY-MM') as period_month, total_amount, status, gmv, commission_amount, monthly_fee
       from public.billing_records where store_id = $1 order by period_month desc limit 12`,
      [storeId],
    );
    return { store: toStoreInfo(row), qrVersion: Number(row.qr_version), members, billing };
  });
}

export async function updateStoreSettings(
  userId: string,
  storeId: string,
  data: { name: string; category: string; address: string; phone: string; description: string; openingHours: string; pickupNote: string },
) {
  const rows = await asUser(userId, (q) =>
    q.query(
      `update public.stores set name = $2, category = $3, address = $4, phone = $5, description = $6,
         opening_hours = $7, pickup_note = $8
       where id = $1 returning id`,
      [storeId, data.name, data.category, data.address, data.phone, data.description, data.openingHours, data.pickupNote],
    ),
  );
  if (rows.length === 0) throw new AppError("forbidden");
}

export async function changeStorePlan(userId: string, storeId: string, plan: PlanCode) {
  await asUser(userId, (q) => q.query("select public.change_store_plan($1::uuid, $2)", [storeId, plan]));
}

export async function rotateStoreQr(userId: string, storeId: string) {
  await asUser(userId, (q) => q.query("select public.rotate_store_qr($1::uuid)", [storeId]));
}

export async function getStoreQrVersion(userId: string, storeId: string) {
  const [row] = await asUser(userId, (q) =>
    q.query<{ qr_version: number; name: string }>("select qr_version, name from public.stores where id = $1", [storeId]),
  );
  if (!row) throw new AppError("forbidden");
  return row;
}

export async function deleteTemplate(userId: string, storeId: string, templateId: string) {
  await asUser(userId, (q) => q.query("delete from public.product_templates where id = $1 and store_id = $2", [templateId, storeId]));
}

export async function setTemplateAutoRelist(userId: string, storeId: string, templateId: string, enabled: boolean, weekdays: number[]) {
  await asUser(userId, (q) =>
    q.query(
      "update public.product_templates set auto_relist = $3, auto_relist_weekdays = $4::smallint[] where id = $1 and store_id = $2",
      [templateId, storeId, enabled, weekdays],
    ),
  );
}

export type SalesHistoryRow = {
  rescuePrice: number;
  originalPrice: number;
  listed: number;
  reserved: number;
  completed: number;
  minutesToSellOut: number | null;
};

export async function recentSalesHistory(userId: string, storeId: string, category: string, isBox: boolean) {
  const rows = await asUser(userId, (q) =>
    q.query(
      `select rescue_price, original_price, quantity_listed, quantity_reserved, quantity_completed, minutes_to_sell_out
       from public.product_sales_history
       where store_id = $1 and category::text = $2 and is_box = $3 and pickup_end_at < now()
       order by pickup_start_at desc limit 14`,
      [storeId, category, isBox],
    ),
  );
  return rows.map(
    (r): SalesHistoryRow => ({
      rescuePrice: Number(r.rescue_price),
      originalPrice: Number(r.original_price),
      listed: Number(r.quantity_listed),
      reserved: Number(r.quantity_reserved),
      completed: Number(r.quantity_completed),
      minutesToSellOut: r.minutes_to_sell_out == null ? null : Number(r.minutes_to_sell_out),
    }),
  );
}

export function weekdayLabel(d: number) {
  return ["日", "月", "火", "水", "木", "金", "土"][d] ?? "";
}
