import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asAnon, asService, asUser } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { createOrder } from "@/server/services/orders";
import { createProduct, createTestDb, IDS, setOrderStatus } from "./support/db";

let driver: Driver | undefined;

beforeEach(async () => {
  await driver?.close();
  driver = await createTestDb();
});

afterAll(async () => {
  await driver?.close();
});

/** userA が店舗A、userB が店舗B に注文し、それぞれに決済・受取イベントの行を作る */
async function setup() {
  const a = await createOrder(IDS.userA, await createProduct(IDS.storeA), 1);
  const b = await createOrder(IDS.userB, await createProduct(IDS.storeB), 1);
  await asService(async (q) => {
    for (const [order, user] of [
      [a, IDS.userA],
      [b, IDS.userB],
    ] as const) {
      await q.query(
        "insert into public.payments (order_id, provider, amount, application_fee_amount) values ($1, 'stripe', $2, $3)",
        [order.id, order.total, order.platformFeeTotal],
      );
      await q.query(
        "insert into public.pickup_events (order_id, user_id, actor, kind) values ($1, $2, 'user', 'swipe')",
        [order.id, user],
      );
    }
    await q.query(
      "insert into public.payment_events (provider, provider_event_id, event_type, payload) values ('stripe', 'evt_1', 'payment_intent.succeeded', '{}')",
    );
  });
  return { a, b };
}

const count = async (userId: string, table: string) =>
  (await asUser(userId, (q) => q.query(`select * from public.${table}`))).length;

describe("RLS: v2 注文のデータ分離", () => {
  it("ユーザーは自分の注文・明細・決済・受取イベントだけを閲覧できる", async () => {
    const { a, b } = await setup();
    const orders = await asUser(IDS.userA, (q) => q.query<{ id: string }>("select id from public.orders"));
    expect(orders.map((o) => o.id)).toEqual([a.id]);
    for (const table of ["order_items", "payments", "pickup_events"]) {
      expect(await count(IDS.userA, table)).toBe(1);
    }
    const other = await asUser(IDS.userA, (q) => q.query("select * from public.orders where id = $1", [b.id]));
    expect(other).toHaveLength(0);
  });

  it("店舗スタッフは自店舗の注文・明細だけを閲覧でき、他店舗の注文は見えない", async () => {
    const { a, b } = await setup();
    const seenByA = await asUser(IDS.staffA, (q) => q.query<{ id: string }>("select id from public.orders"));
    expect(seenByA.map((o) => o.id)).toEqual([a.id]);
    const items = await asUser(IDS.staffA, (q) => q.query<{ order_id: string }>("select order_id from public.order_items"));
    expect(items.map((i) => i.order_id)).toEqual([a.id]);
    const seenByB = await asUser(IDS.staffB, (q) => q.query<{ id: string }>("select id from public.orders"));
    expect(seenByB.map((o) => o.id)).toEqual([b.id]);
  });

  it("anon は注文・決済を一切閲覧できない", async () => {
    await setup();
    for (const table of ["orders", "order_items", "payments", "payment_events", "pickup_events", "platform_settings"]) {
      await expect(asAnon((q) => q.query(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
    }
  });

  it("一般ユーザー・店舗スタッフは payment_events を参照・操作できない", async () => {
    await setup();
    for (const user of [IDS.userA, IDS.staffA, IDS.ownerA]) {
      await expect(asUser(user, (q) => q.query("select * from public.payment_events"))).rejects.toThrow(/permission denied/);
      await expect(
        asUser(user, (q) =>
          q.query(
            "insert into public.payment_events (provider, provider_event_id, event_type) values ('stripe', 'evt_x', 'x')",
          ),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(user, (q) => q.query("update public.payment_events set processed_at = now()")),
      ).rejects.toThrow(/permission denied/);
      await expect(asUser(user, (q) => q.query("delete from public.payment_events"))).rejects.toThrow(/permission denied/);
    }
  });

  it("一般ユーザー・店舗スタッフは注文・決済の状態や金額を直接変更できない", async () => {
    const { a } = await setup();
    for (const user of [IDS.userA, IDS.staffA, IDS.ownerA]) {
      await expect(
        asUser(user, (q) => q.query("update public.orders set status = 'paid' where id = $1", [a.id])),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(user, (q) => q.query("update public.payments set status = 'succeeded' where order_id = $1", [a.id])),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(user, (q) =>
          q.query("insert into public.payments (order_id, provider, amount) values ($1, 'stripe', 1)", [a.id]),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(user, (q) =>
          q.query("insert into public.pickup_events (order_id, user_id, actor, kind) values ($1, $2, 'user', 'swipe')", [
            a.id,
            IDS.userA,
          ]),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(user, (q) => q.query("select public.sweep_orders()")),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("同じ Webhook イベントは二重に記録できない（provider + provider_event_id の一意制約）", async () => {
    await setup();
    await expect(
      asService((q) =>
        q.query(
          "insert into public.payment_events (provider, provider_event_id, event_type) values ('stripe', 'evt_1', 'payment_intent.succeeded')",
        ),
      ),
    ).rejects.toThrow();
    const inserted = await asService((q) =>
      q.query(
        `insert into public.payment_events (provider, provider_event_id, event_type) values ('stripe', 'evt_1', 'payment_intent.succeeded')
         on conflict (provider, provider_event_id) do nothing returning id`,
      ),
    );
    expect(inserted).toHaveLength(0);
  });

  it("受取イベント・注文明細は追記のみ（service でも更新・削除できない）", async () => {
    const { a } = await setup();
    await expect(
      asService((q) => q.query("update public.pickup_events set kind = 'admin_override' where order_id = $1", [a.id])),
    ).rejects.toThrow();
    await expect(
      asService((q) => q.query("delete from public.order_items where order_id = $1", [a.id])),
    ).rejects.toThrow();
  });

  it("注文したユーザーは店舗が停止中でも注文に必要な店舗・商品を閲覧できる", async () => {
    const productId = await createProduct(IDS.storeA);
    const order = await createOrder(IDS.userA, productId, 1);
    await setOrderStatus(order.id, "paid");
    await asService((q) => q.query("update public.stores set status = 'suspended' where id = $1", [IDS.storeA]));
    expect(await asUser(IDS.userA, (q) => q.query("select id from public.stores where id = $1", [IDS.storeA]))).toHaveLength(1);
    expect(await asUser(IDS.userB, (q) => q.query("select id from public.stores where id = $1", [IDS.storeA]))).toHaveLength(0);
  });
});
