import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { ORDER_POLICY } from "@/lib/orders";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { getPointsBalance } from "@/server/services/orders";
import { getMyOrder, refundOrder, requestUserRefund, storeRefundOrder } from "@/server/services/payments";
import { createTestDb, getOrder, getProduct, IDS } from "./support/db";
import { connectStore, createPaidOrder, installFakeStripe, uninstallFakeStripe, type FakeStripe } from "./support/stripe";

let driver: Driver | undefined;
let fake: FakeStripe;

beforeEach(async () => {
  await driver?.close();
  driver = await createTestDb();
  fake = installFakeStripe();
  await connectStore(IDS.storeA, "acct_storeA");
  await connectStore(IDS.storeB, "acct_storeB");
});

afterEach(() => uninstallFakeStripe());

afterAll(async () => {
  await driver?.close();
});

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((e: AppError) => expect(e.code).toBe(code));
}

/** 受取開始が30分後の paid 注文 */
const paidBeforePickup = (userId: string = IDS.userA, storeId: string = IDS.storeA, quantity = 3) =>
  createPaidOrder(fake, userId, storeId, { startIn: 30, endIn: 120, quantity });

const setPaidAgo = (orderId: string, minutes: number) =>
  asService((q) =>
    q.query("update public.orders set paid_at = now() - make_interval(mins => $2) where id = $1", [orderId, minutes]),
  );

const refundRows = (orderId: string) =>
  asService((q) =>
    q.query<{ status: string; actor: string; amount: number; restock: boolean; provider_refund_id: string | null }>(
      "select status, actor::text, amount, restock, provider_refund_id from public.refunds where order_id = $1 order by created_at",
      [orderId],
    ),
  );

describe("お客様都合の返金", () => {
  it(`決済から${ORDER_POLICY.userRefundWindowMinutes}分以内・受取開始前なら全額返金でき、ポイントは -30、在庫が戻る`, async () => {
    const { order, productId, piId } = await paidBeforePickup();
    expect((await getProduct(productId)).remaining_quantity).toBe(2);
    expect(await getPointsBalance(IDS.userA)).toBe(30);
    expect((await getMyOrder(IDS.userA, order.id))!.userRefundable).toBe(true);

    const result = await requestUserRefund(IDS.userA, order.id);
    expect(result.status).toBe("succeeded");
    expect(fake.refunds[0].params).toMatchObject({ payment_intent: piId, reverse_transfer: true, refund_application_fee: true });

    const row = await getOrder(order.id);
    expect(row.status).toBe("refunded");
    expect(await refundRows(order.id)).toEqual([
      { status: "succeeded", actor: "user", amount: order.total, restock: true, provider_refund_id: expect.stringMatching(/^re_/) },
    ]);
    expect(await getPointsBalance(IDS.userA)).toBe(0);
    expect((await getProduct(productId)).remaining_quantity).toBe(3);
    const [p] = await asService((q) => q.query<{ status: string }>("select status from public.payments where order_id = $1 and provider_payment_id is not null", [order.id]));
    expect(p.status).toBe("refunded");
  });

  it(`決済から${ORDER_POLICY.userRefundWindowMinutes}分を過ぎたら返金できない（設定値から判定）`, async () => {
    const { order } = await paidBeforePickup();
    await setPaidAgo(order.id, ORDER_POLICY.userRefundWindowMinutes + 1);
    await expectAppError(requestUserRefund(IDS.userA, order.id), "refund_window_closed");
    expect((await getOrder(order.id)).status).toBe("paid");
    expect(fake.refunds).toHaveLength(0);

    // 設定値を変えると判定も変わる（コードに 5 分を埋め込んでいない）
    await asService((q) => q.query("update public.platform_settings set int_value = 30 where key = 'user_refund_window_minutes'"));
    await requestUserRefund(IDS.userA, order.id);
    expect((await getOrder(order.id)).status).toBe("refunded");
  });

  it("受取開始後は返金できない", async () => {
    const { order } = await createPaidOrder(fake, IDS.userA, IDS.storeA, { startIn: -5, endIn: 60 });
    await expectAppError(requestUserRefund(IDS.userA, order.id), "refund_window_closed");
    expect((await getMyOrder(IDS.userA, order.id))!.userRefundable).toBe(false);
  });

  it("他人の注文は返金できない", async () => {
    const { order } = await paidBeforePickup();
    await expectAppError(requestUserRefund(IDS.userB, order.id), "order_not_found");
  });

  it("二重に返金できない（同時に押しても Stripe の返金は1件）", async () => {
    const { order } = await paidBeforePickup();
    const results = await Promise.allSettled([requestUserRefund(IDS.userA, order.id), requestUserRefund(IDS.userA, order.id)]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    await expectAppError(requestUserRefund(IDS.userA, order.id), "already_refunded");
    expect(new Set(fake.refunds.map((r) => r.idempotencyKey)).size).toBe(1);
    expect(await refundRows(order.id)).toHaveLength(1);
    expect(await getPointsBalance(IDS.userA)).toBe(0);
  });
});

describe("店舗都合・システム都合の返金", () => {
  it("店舗都合は受取開始後でも全額返金（理由必須・在庫は戻さない）", async () => {
    const { order, productId } = await createPaidOrder(fake, IDS.userA, IDS.storeA, { startIn: -5, endIn: 60, quantity: 3 });
    await expectAppError(storeRefundOrder(IDS.staffA, order.id, " "), "reason_required");
    await storeRefundOrder(IDS.staffA, order.id, "品切れのため");
    expect((await getOrder(order.id)).status).toBe("refunded");
    expect(await refundRows(order.id)).toMatchObject([{ status: "succeeded", actor: "store", amount: order.total, restock: false }]);
    expect((await getProduct(productId)).remaining_quantity).toBe(2);
    expect(await getPointsBalance(IDS.userA)).toBe(0);
  });

  it("他店舗のスタッフ・一般ユーザーは店舗都合の返金をできない", async () => {
    const { order } = await paidBeforePickup();
    await expectAppError(storeRefundOrder(IDS.staffB, order.id, "品切れ"), "forbidden");
    await expectAppError(storeRefundOrder(IDS.userB, order.id, "品切れ"), "forbidden");
    expect((await getOrder(order.id)).status).toBe("paid");
  });

  it("システム都合は全額返金し、受取終了前なら在庫を戻す", async () => {
    const { order, productId } = await paidBeforePickup();
    await refundOrder({ orderId: order.id, actor: "system", reason: "store_suspended" });
    expect((await getOrder(order.id)).status).toBe("refunded");
    expect(await refundRows(order.id)).toMatchObject([{ actor: "system", amount: order.total, restock: true }]);
    expect((await getProduct(productId)).remaining_quantity).toBe(3);
    expect(await getPointsBalance(IDS.userA)).toBe(0);
  });

  it("管理者以外は admin として返金できない", async () => {
    const { order } = await paidBeforePickup();
    await expectAppError(refundOrder({ orderId: order.id, actor: "admin", reason: "x", requestedBy: IDS.userA }), "forbidden");
    await refundOrder({ orderId: order.id, actor: "admin", reason: "問い合わせ対応", requestedBy: IDS.admin });
    expect((await getOrder(order.id)).status).toBe("refunded");
  });

  it("受取済み・未受取の注文は返金しない", async () => {
    const a = await paidBeforePickup();
    await asService((q) => q.query("update public.orders set status = 'picked_up' where id = $1", [a.order.id]));
    await expectAppError(refundOrder({ orderId: a.order.id, actor: "system", reason: "x" }), "not_refundable");
    const b = await paidBeforePickup(IDS.userB);
    await asService((q) => q.query("update public.orders set status = 'unclaimed' where id = $1", [b.order.id]));
    await expectAppError(storeRefundOrder(IDS.staffA, b.order.id, "x"), "not_refundable");
    expect(fake.refunds).toHaveLength(0);
  });
});

describe("Stripe 側の失敗", () => {
  it("Stripe の返金に失敗したら注文は paid のまま。あとでもう一度返金できる", async () => {
    const { order } = await paidBeforePickup();
    fake.state.refundError = new Error("stripe is down");
    await expectAppError(requestUserRefund(IDS.userA, order.id), "refund_failed");
    expect((await getOrder(order.id)).status).toBe("paid");
    expect(await getPointsBalance(IDS.userA)).toBe(30);
    expect((await refundRows(order.id))[0].status).toBe("failed");

    fake.state.refundError = null;
    await requestUserRefund(IDS.userA, order.id);
    expect((await getOrder(order.id)).status).toBe("refunded");
    expect((await refundRows(order.id)).map((r) => r.status)).toEqual(["failed", "succeeded"]);
  });

  it("Stripe が返金を処理中（pending）で受け付けたら注文は refunded、charge.refunded で返金を確定する", async () => {
    const { order } = await paidBeforePickup();
    fake.state.refundStatus = "pending";
    const result = await requestUserRefund(IDS.userA, order.id);
    expect(result.status).toBe("pending");
    expect((await getOrder(order.id)).status).toBe("refunded");
    expect((await getMyOrder(IDS.userA, order.id))!.refundStatus).toBe("pending");
  });

  it("返金の記録後・Stripe 送信前に止まっても、再実行で同じ返金を再開する（冪等キー）", async () => {
    const { order } = await paidBeforePickup();
    // begin_refund だけ実行された状態を作る
    await asService((q) =>
      q.query("select public.begin_refund($1::uuid, 'user', 'user_cancel', $2::uuid)", [order.id, IDS.userA]),
    );
    await requestUserRefund(IDS.userA, order.id);
    expect(await refundRows(order.id)).toHaveLength(1);
    expect((await getOrder(order.id)).status).toBe("refunded");
  });
});
