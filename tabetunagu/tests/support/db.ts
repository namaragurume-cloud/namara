import { runMigrations } from "@/server/db/migrate";
import { createPgliteDriver, wrapPglite } from "@/server/db/pglite";
import { asService, setDriverForTesting } from "@/server/db";
import type { Driver } from "@/server/db/types";

export const IDS = {
  userA: "10000000-0000-4000-8000-000000000001",
  userB: "10000000-0000-4000-8000-000000000002",
  staffA: "10000000-0000-4000-8000-000000000003",
  staffB: "10000000-0000-4000-8000-000000000004",
  ownerA: "10000000-0000-4000-8000-000000000005",
  admin: "10000000-0000-4000-8000-000000000006",
  storeA: "20000000-0000-4000-8000-000000000001",
  storeB: "20000000-0000-4000-8000-000000000002",
  storeSuspended: "20000000-0000-4000-8000-000000000003",
} as const;

let template: Awaited<ReturnType<typeof createPgliteDriver>> | undefined;

/** マイグレーションと基本データを入れた DB を作る（テンプレートを clone するので速い） */
export async function createTestDb(): Promise<Driver> {
  if (!template) {
    template = await createPgliteDriver();
    await runMigrations(template, { bootstrap: true });
    setDriverForTesting(template);
    await insertFixtures();
  }
  const driver = wrapPglite(await template.pglite.clone());
  setDriverForTesting(driver);
  return driver;
}

async function insertFixtures() {
  await asService(async (q) => {
    for (const [key, id] of Object.entries(IDS)) {
      if (!key.startsWith("store")) {
        await q.query("insert into public.users (id, display_name) values ($1, $2)", [id, key]);
      }
    }
    await q.query(
      `insert into public.stores (id, slug, name, category, area_id, status, plan_code) values
         ($1, 'store-a', '店舗A', 'bread', 'odori', 'active', 'free'),
         ($2, 'store-b', '店舗B', 'deli', 'susukino', 'active', 'standard'),
         ($3, 'store-c', '停止店舗', 'bento', 'odori', 'suspended', 'free')`,
      [IDS.storeA, IDS.storeB, IDS.storeSuspended],
    );
    await q.query(
      `insert into public.store_members (store_id, user_id, role) values
         ($1, $3, 'staff'), ($1, $5, 'owner'), ($2, $4, 'staff')`,
      [IDS.storeA, IDS.storeB, IDS.staffA, IDS.staffB, IDS.ownerA],
    );
    await q.query("insert into public.admin_users (user_id) values ($1)", [IDS.admin]);
  });
}

/** 商品を作る（受取時間は現在時刻からの分で指定） */
export async function createProduct(
  storeId: string,
  opts: { quantity?: number; startIn?: number; endIn?: number; price?: number; status?: string; maxPer?: number } = {},
) {
  const now = Date.now();
  const start = new Date(now + (opts.startIn ?? -10) * 60_000);
  const end = new Date(now + (opts.endIn ?? 120) * 60_000);
  const [row] = await asService((q) =>
    q.query<{ id: string }>(
      `insert into public.products (store_id, name, category, is_box, original_price, rescue_price, quantity,
         pickup_start_at, pickup_end_at, status, max_per_reservation)
       values ($1, 'テストBOX', 'bread', true, 1500, $2, $3, $4, $5, $6, $7) returning id`,
      [storeId, opts.price ?? 800, opts.quantity ?? 3, start.toISOString(), end.toISOString(), opts.status ?? "published", opts.maxPer ?? 3],
    ),
  );
  return row.id;
}

export async function getProduct(id: string) {
  const [row] = await asService((q) =>
    q.query<{ remaining_quantity: number; status: string; quantity: number }>(
      "select remaining_quantity, status::text, quantity from public.products where id = $1",
      [id],
    ),
  );
  return row;
}

export async function getReservation(id: string) {
  const [row] = await asService((q) =>
    q.query<{ status: string; completed_at: Date | null; commission_rate: number | null; plan_code: string | null }>(
      "select status::text, completed_at, commission_rate::float8 as commission_rate, plan_code from public.reservations where id = $1",
      [id],
    ),
  );
  return row;
}

/** 予約の受取時間をずらす（受取時間外のテスト用） */
export async function shiftReservationWindow(id: string, startIn: number, endIn: number) {
  const now = Date.now();
  await asService((q) =>
    q.query("update public.reservations set pickup_start_at = $2, pickup_end_at = $3 where id = $1", [
      id,
      new Date(now + startIn * 60_000).toISOString(),
      new Date(now + endIn * 60_000).toISOString(),
    ]),
  );
}

export async function getOrder(id: string) {
  const [row] = await asService((q) =>
    q.query<{
      status: string;
      subtotal: number;
      plan_code: string;
      cancelled_by: string | null;
      cancelled_at: Date | null;
      paid_at: Date | null;
      picked_up_at: Date | null;
      payment_expires_at: Date;
      pickup_end: Date;
    }>(
      `select status::text, subtotal, plan_code, cancelled_by::text, cancelled_at, paid_at, picked_up_at,
              payment_expires_at, pickup_end
       from public.orders where id = $1`,
      [id],
    ),
  );
  return row;
}

/** 注文の状態を service で変更する（STEP 1 では決済・受取の処理がまだないため、テストで直接遷移させる） */
export async function setOrderStatus(id: string, status: string) {
  await asService((q) => q.query("update public.orders set status = $2::public.order_status where id = $1", [id, status]));
}

/** 決済待ちの期限を過去にする */
export async function expireOrderPayment(id: string) {
  await asService((q) =>
    q.query("update public.orders set payment_expires_at = now() - interval '1 minute' where id = $1", [id]),
  );
}

/**
 * テスト専用: 注文の受取時間を現在時刻からの分でずらす（受取時間は通常変更できないため、同じトランザクション内でガードを外す）。
 * 受取時間を過ぎた注文は create_order で作れないため、作成後にずらして再現する。
 */
/** 受取時間を絶対時刻で設定する（固定時刻のテスト用。注文のガードを外して直接更新する） */
export async function setOrderWindow(id: string, start: string, end: string) {
  await asService(async (q) => {
    await q.query("alter table public.orders disable trigger orders_guard");
    await q.query("update public.orders set pickup_start = $2, pickup_end = $3 where id = $1", [
      id,
      new Date(start).toISOString(),
      new Date(end).toISOString(),
    ]);
    await q.query("alter table public.orders enable trigger orders_guard");
  });
}

export async function shiftOrderWindow(id: string, startIn: number, endIn: number) {
  const now = Date.now();
  await asService(async (q) => {
    await q.query("alter table public.orders disable trigger orders_guard");
    await q.query("update public.orders set pickup_start = $2, pickup_end = $3 where id = $1", [
      id,
      new Date(now + startIn * 60_000).toISOString(),
      new Date(now + endIn * 60_000).toISOString(),
    ]);
    await q.query("alter table public.orders enable trigger orders_guard");
  });
}
