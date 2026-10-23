import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { calcOrderAmounts, PRICING } from "@/lib/fees";
import { canTransition, ORDER_POLICY, ORDER_STATUSES, type OrderStatus } from "@/lib/orders";
import { asService, asUser } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { cancelPendingOrder, createOrder, sweepOrders } from "@/server/services/orders";
import { createReservation } from "@/server/services/reservations";
import { createProduct, createTestDb, expireOrderPayment, getOrder, getProduct, IDS, setOrderStatus } from "./support/db";

let driver: Driver | undefined;

beforeEach(async () => {
  await driver?.close();
  driver = await createTestDb();
});

afterAll(async () => {
  await driver?.close();
});

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((e: AppError) => expect(e.code).toBe(code));
}

describe("注文作成（在庫の仮押さえ）", () => {
  it("pending_payment の注文が作成され、在庫が減り、金額はサーバーで計算される", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 3, price: 800 });
    const before = Date.now();
    const order = await createOrder(IDS.userA, productId, 2);

    expect(order.status).toBe("pending_payment");
    expect(order.orderNumber).toMatch(/^[2-9A-Z]{6}$/);
    // 店舗A は FREE（20%）
    const expected = calcOrderAmounts([{ unitPrice: 800, quantity: 2 }], PRICING.plans.free.commissionBps);
    expect(order.subtotal).toBe(expected.subtotal);
    expect(order.tsunaguCharge).toBe(30);
    expect(order.total).toBe(1630);
    expect(order.commissionBps).toBe(2000);
    expect(order.commissionAmount).toBe(320);
    expect(order.platformFeeTotal).toBe(350);

    const expiresIn = new Date(order.paymentExpiresAt).getTime() - before;
    expect(expiresIn).toBeGreaterThan((ORDER_POLICY.paymentHoldMinutes - 1) * 60_000);
    expect(expiresIn).toBeLessThanOrEqual(ORDER_POLICY.paymentHoldMinutes * 60_000 + 5_000);

    expect((await getProduct(productId)).remaining_quantity).toBe(1);

    const [item] = await asService((q) =>
      q.query<{ product_name_snapshot: string; unit_price: number; quantity: number; line_total: number }>(
        "select product_name_snapshot, unit_price, quantity, line_total from public.order_items where order_id = $1",
        [order.id],
      ),
    );
    expect(item).toEqual({ product_name_snapshot: "テストBOX", unit_price: 800, quantity: 2, line_total: 1600 });
  });

  it("STANDARD 店舗は手数料 8%、プランは注文時点のスナップショット", async () => {
    const order = await createOrder(IDS.userA, await createProduct(IDS.storeB, { price: 1000 }), 1);
    expect(order.commissionBps).toBe(800);
    expect(order.commissionAmount).toBe(80);
    expect(order.platformFeeTotal).toBe(110);
    const row = await getOrder(order.id);
    expect(row.plan_code).toBe("standard");
  });

  it("注文後に商品名・価格を変えても注文明細は変わらない", async () => {
    const productId = await createProduct(IDS.storeA, { price: 800 });
    const order = await createOrder(IDS.userA, productId, 1);
    await asService((q) =>
      q.query("update public.products set name = '名前を変更', rescue_price = 500 where id = $1", [productId]),
    );
    const [item] = await asService((q) =>
      q.query<{ product_name_snapshot: string; unit_price: number }>(
        "select product_name_snapshot, unit_price from public.order_items where order_id = $1",
        [order.id],
      ),
    );
    expect(item).toEqual({ product_name_snapshot: "テストBOX", unit_price: 800 });
    expect((await getOrder(order.id)).subtotal).toBe(800);
  });

  it("在庫が足りない注文は失敗し、在庫は減らない", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 2, maxPer: 5 });
    await expectAppError(createOrder(IDS.userA, productId, 3), "insufficient_stock");
    expect((await getProduct(productId)).remaining_quantity).toBe(2);

    const soldOut = await createProduct(IDS.storeA, { quantity: 1 });
    await createOrder(IDS.userA, soldOut, 1);
    expect((await getProduct(soldOut)).status).toBe("sold_out");
    await expectAppError(createOrder(IDS.userB, soldOut, 1), "sold_out");
  });

  it("同時に最後の1個を注文しても、成功するのは1件だけ（予約との取り合いも含む）", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 1 });
    const results = await Promise.allSettled([
      createOrder(IDS.userA, productId, 1),
      createOrder(IDS.userB, productId, 1),
      createReservation(IDS.ownerA, productId, 1),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await getProduct(productId)).remaining_quantity).toBe(0);
    const [{ count }] = await asService((q) =>
      q.query<{ count: number }>(
        `select (select count(*) from public.order_items where product_id = $1)
              + (select count(*) from public.reservations where product_id = $1) as count`,
        [productId],
      ),
    );
    expect(Number(count)).toBe(1);
  });

  it("同じ商品を重複して注文できない・決済待ちは上限まで", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 5 });
    await createOrder(IDS.userA, productId, 1);
    await expectAppError(createOrder(IDS.userA, productId, 1), "already_ordered");

    for (let i = 1; i < ORDER_POLICY.maxPendingOrdersPerUser; i++) {
      await createOrder(IDS.userA, await createProduct(IDS.storeA), 1);
    }
    await expectAppError(createOrder(IDS.userA, await createProduct(IDS.storeA), 1), "too_many_pending");
  });

  it("停止店舗・受取終了・未ログインの注文はできない", async () => {
    await expectAppError(createOrder(IDS.userA, await createProduct(IDS.storeSuspended), 1), "store_inactive");
    await expectAppError(
      createOrder(IDS.userA, await createProduct(IDS.storeA, { startIn: -120, endIn: -1 }), 1),
      "pickup_ended",
    );
    const productId = await createProduct(IDS.storeA);
    await expectAppError(
      asService((q) => q.query("select public.create_order($1::uuid, 1)", [productId])),
      "not_authenticated",
    );
  });

  it("決済待ちの期限は受取終了時刻を超えない", async () => {
    const productId = await createProduct(IDS.storeA, { startIn: -10, endIn: 5 });
    const order = await createOrder(IDS.userA, productId, 1);
    const row = await getOrder(order.id);
    expect(new Date(row.payment_expires_at).getTime()).toBe(new Date(row.pickup_end).getTime());
  });
});

describe("決済期限切れ・中断", () => {
  it("期限切れの pending_payment は cancelled になり、在庫が戻る", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 1 });
    const order = await createOrder(IDS.userA, productId, 1);
    expect((await getProduct(productId)).status).toBe("sold_out");

    expect((await sweepOrders()).expired_orders).toBe(0); // 期限前は何もしない
    await expireOrderPayment(order.id);
    expect((await sweepOrders()).expired_orders).toBe(1);

    const row = await getOrder(order.id);
    expect(row.status).toBe("cancelled");
    expect(row.cancelled_by).toBe("system");
    expect(row.cancelled_at).not.toBeNull();
    const p = await getProduct(productId);
    expect(p.remaining_quantity).toBe(1);
    expect(p.status).toBe("published");

    expect((await sweepOrders()).expired_orders).toBe(0); // 二重に在庫を戻さない
    expect((await getProduct(productId)).remaining_quantity).toBe(1);
  });

  it("paid の注文は期限を過ぎても在庫を戻さない", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 2 });
    const order = await createOrder(IDS.userA, productId, 1);
    await setOrderStatus(order.id, "paid");
    await expireOrderPayment(order.id);
    expect((await sweepOrders()).expired_orders).toBe(0);
    expect((await getOrder(order.id)).status).toBe("paid");
    expect((await getProduct(productId)).remaining_quantity).toBe(1);
  });

  it("本人は決済前の注文を中断でき、在庫が戻る。他人の注文は中断できない", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 2 });
    const order = await createOrder(IDS.userA, productId, 1);
    await expectAppError(cancelPendingOrder(IDS.userB, order.id), "order_not_found");
    const cancelled = await cancelPendingOrder(IDS.userA, order.id);
    expect(cancelled.status).toBe("cancelled");
    expect((await getProduct(productId)).remaining_quantity).toBe(2);
    await expectAppError(cancelPendingOrder(IDS.userA, order.id), "not_cancellable");
  });

  it("有効な注文がある商品は削除できない（旧フローの削除ガードが v2 注文も考慮する）", async () => {
    const productId = await createProduct(IDS.storeA);
    await createOrder(IDS.userA, productId, 1);
    await expectAppError(
      asUser(IDS.staffA, (q) => q.query("select public.delete_product($1::uuid)", [productId])),
      "has_active_reservations",
    );
  });
});

describe("注文の状態遷移", () => {
  const PATHS: Record<OrderStatus, OrderStatus[]> = {
    pending_payment: [],
    paid: ["paid"],
    picked_up: ["paid", "picked_up"],
    unclaimed: ["paid", "unclaimed"],
    cancelled: ["cancelled"],
    refunded: ["paid", "refunded"],
  };

  it("許可された遷移だけができる（src/lib/orders.ts と DB トリガーが一致）", async () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        if (from === to) continue;
        const order = await createOrder(IDS.userA, await createProduct(IDS.storeA), 1);
        for (const step of PATHS[from]) await setOrderStatus(order.id, step);
        const attempt = setOrderStatus(order.id, to);
        if (canTransition(from, to)) {
          await attempt;
          expect((await getOrder(order.id)).status).toBe(to);
        } else {
          const error = await attempt.then(() => null, (e: unknown) => e);
          expect((error as AppError | null)?.code, `${from} → ${to}`).toBe("invalid_order_transition");
        }
        // 決済待ちの上限に当たらないよう片付ける
        if ((await getOrder(order.id)).status === "pending_payment") await setOrderStatus(order.id, "cancelled");
      }
    }
  });

  it("受取済みの注文は返金状態にできない", async () => {
    const order = await createOrder(IDS.userA, await createProduct(IDS.storeA), 1);
    await setOrderStatus(order.id, "paid");
    await setOrderStatus(order.id, "picked_up");
    await expectAppError(setOrderStatus(order.id, "refunded"), "invalid_order_transition");
  });

  it("遷移の時刻が記録され、金額は変更できない", async () => {
    const order = await createOrder(IDS.userA, await createProduct(IDS.storeA), 1);
    await setOrderStatus(order.id, "paid");
    await setOrderStatus(order.id, "picked_up");
    const row = await getOrder(order.id);
    expect(row.paid_at).not.toBeNull();
    expect(row.picked_up_at).not.toBeNull();
    await expectAppError(
      asService((q) => q.query("update public.orders set total = 1 where id = $1", [order.id])),
      "order_immutable",
    );
  });

  it("注文は pending_payment 以外の状態では作成できない", async () => {
    await expectAppError(
      asService((q) =>
        q.query(
          `insert into public.orders (order_number, user_id, store_id, status, subtotal, tsunagu_charge, total,
             commission_bps, commission_amount, platform_fee_total, plan_code, pickup_start, pickup_end, payment_expires_at, paid_at)
           values ('ZZZZZZ', $1, $2, 'paid', 800, 30, 830, 2000, 160, 190, 'free', now(), now() + interval '1 hour', now(), now())`,
          [IDS.userA, IDS.storeA],
        ),
      ),
      "invalid_order_transition",
    );
  });
});
