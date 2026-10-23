import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { PRICING } from "@/lib/fees";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { createOrder } from "@/server/services/orders";
import { purchase, startCheckout, sweepOrdersAndCheckouts } from "@/server/services/payments";
import { createProduct, createTestDb, expireOrderPayment, getOrder, getProduct, IDS } from "./support/db";
import { connectStore, installFakeStripe, uninstallFakeStripe, type FakeStripe } from "./support/stripe";

let driver: Driver | undefined;
let fake: FakeStripe;

beforeEach(async () => {
  await driver?.close();
  driver = await createTestDb();
  fake = installFakeStripe();
  await connectStore(IDS.storeA, "acct_storeA");
  await connectStore(IDS.storeB, "acct_storeB");
});

afterEach(() => {
  uninstallFakeStripe();
  delete process.env.STRIPE_CHECKOUT_RETURN_URL;
});

afterAll(async () => {
  await driver?.close();
});

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((e: AppError) => expect(e.code).toBe(code));
}

const payments = (orderId: string) =>
  asService((q) =>
    q.query<{ status: string; amount: number; application_fee_amount: number; connected_account_id: string; checkout_session_id: string | null }>(
      "select status, amount, application_fee_amount, connected_account_id, checkout_session_id from public.payments where order_id = $1 order by created_at",
      [orderId],
    ),
  );

describe("Stripe Checkout の作成", () => {
  it("pending_payment の注文から、注文の金額どおりの Checkout Session を作る（destination charge）", async () => {
    const productId = await createProduct(IDS.storeA, { price: 1000 });
    const order = await createOrder(IDS.userA, productId, 1);
    const url = await startCheckout(IDS.userA, order.id);
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);

    const { params, idempotencyKey } = fake.sessions[0];
    const lineTotal = params.line_items!.reduce((s, li) => s + (li.price_data!.unit_amount as number) * (li.quantity as number), 0);
    expect(lineTotal).toBe(order.total); // 1,030円
    expect(order.total).toBe(1030);
    expect(params.line_items!.map((li) => li.price_data!.product_data!.name)).toEqual(["テストBOX", "つなぐチャージ"]);
    expect(params.line_items![1].price_data!.unit_amount).toBe(PRICING.tsunaguCharge);
    // application_fee = 成約手数料 200 + つなぐチャージ 30。店舗に残るのは 800
    expect(params.payment_intent_data!.application_fee_amount).toBe(230);
    expect(params.payment_intent_data!.transfer_data!.destination).toBe("acct_storeA");
    expect(params.mode).toBe("payment");
    expect(params.payment_intent_data!.metadata).toMatchObject({
      order_id: order.id,
      order_number: order.orderNumber,
      user_id: IDS.userA,
      store_id: IDS.storeA,
      plan_code: "free",
    });
    expect(params.success_url).toBe(`http://localhost:3000/orders/${order.id}?from=checkout`);
    expect(params.cancel_url).toBe(`http://localhost:3000/orders/${order.id}?from=cancel`);
    expect(idempotencyKey).toMatch(/^tt_checkout_/);

    const [p] = await payments(order.id);
    expect(p).toMatchObject({ status: "pending", amount: 1030, application_fee_amount: 230, connected_account_id: "acct_storeA" });
    expect(p.checkout_session_id).toBe("cs_test_1");
  });

  it("STANDARD 店舗の手数料は 8%（つなぐチャージは手数料の対象外）", async () => {
    const order = await createOrder(IDS.userA, await createProduct(IDS.storeB, { price: 1000 }), 2);
    await startCheckout(IDS.userA, order.id);
    const pid = fake.sessions[0].params.payment_intent_data!;
    expect(order.total).toBe(2030);
    expect(pid.application_fee_amount).toBe(160 + 30);
    expect(pid.transfer_data!.destination).toBe("acct_storeB");
  });

  it("戻り先 URL は設定値（LINE ミニアプリ / LIFF の URL にできる）", async () => {
    process.env.STRIPE_CHECKOUT_RETURN_URL = "https://liff.line.me/1234567890-abcdefgh/";
    const order = await createOrder(IDS.userA, await createProduct(IDS.storeA), 1);
    await startCheckout(IDS.userA, order.id);
    expect(fake.sessions[0].params.success_url).toBe(`https://liff.line.me/1234567890-abcdefgh/orders/${order.id}?from=checkout`);
  });

  it("有効な Checkout Session があれば再利用し、同じ注文で何度も作らない", async () => {
    const order = await createOrder(IDS.userA, await createProduct(IDS.storeA), 1);
    const first = await startCheckout(IDS.userA, order.id);
    const second = await startCheckout(IDS.userA, order.id);
    expect(second).toBe(first);
    expect(fake.sessions).toHaveLength(1);
  });

  it("他人の注文では Checkout を作れない", async () => {
    const order = await createOrder(IDS.userA, await createProduct(IDS.storeA), 1);
    await expectAppError(startCheckout(IDS.userB, order.id), "order_not_found");
    expect(fake.sessions).toHaveLength(0);
  });

  it("売上受取設定が完了していない店舗では決済を開始できず、在庫も押さえない", async () => {
    await asService((q) => q.query("update public.stores set stripe_charges_enabled = false where id = $1", [IDS.storeA]));
    const productId = await createProduct(IDS.storeA, { quantity: 2 });
    await expectAppError(purchase(IDS.userA, productId, 1), "store_payment_unavailable");
    expect((await getProduct(productId)).remaining_quantity).toBe(2);

    // 既存の決済待ち注文も Checkout は作れない
    await asService((q) => q.query("update public.stores set stripe_charges_enabled = true where id = $1", [IDS.storeA]));
    const order = await createOrder(IDS.userA, productId, 1);
    await asService((q) => q.query("update public.stores set stripe_charges_enabled = false where id = $1", [IDS.storeA]));
    await expectAppError(startCheckout(IDS.userA, order.id), "store_payment_unavailable");
    expect(fake.sessions).toHaveLength(0);
  });

  it("決済待ちの期限が切れた注文・支払い済みの注文では Checkout を作れない", async () => {
    const order = await createOrder(IDS.userA, await createProduct(IDS.storeA), 1);
    await expireOrderPayment(order.id);
    await expectAppError(startCheckout(IDS.userA, order.id), "payment_expired");
  });

  it("purchase: 注文を作成して Checkout の URL を返す。Stripe に失敗したら注文を取り消して在庫を戻す", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 2 });
    const ok = await purchase(IDS.userA, productId, 1);
    expect(ok.url).toContain("checkout.stripe.com");
    expect((await getOrder(ok.orderId)).status).toBe("pending_payment");

    fake.state.sessionError = new Error("stripe is down");
    const productId2 = await createProduct(IDS.storeA, { quantity: 2 });
    await expectAppError(purchase(IDS.userB, productId2, 1), "checkout_failed");
    expect((await getProduct(productId2)).remaining_quantity).toBe(2);
    const [failed] = await asService((q) =>
      q.query<{ status: string; payment_status: string }>(
        `select o.status::text, p.status as payment_status from public.orders o join public.payments p on p.order_id = o.id
         where o.user_id = $1`,
        [IDS.userB],
      ),
    );
    expect(failed).toEqual({ status: "cancelled", payment_status: "failed" });
  });

  it("Stripe が未設定の環境では決済を開始できない", async () => {
    uninstallFakeStripe();
    const productId = await createProduct(IDS.storeA, { quantity: 2 });
    await expectAppError(purchase(IDS.userA, productId, 1), "payment_unavailable");
    expect((await getProduct(productId)).remaining_quantity).toBe(2);
  });

  it("期限切れで閉じた注文の Checkout Session は Stripe 側でも期限切れにする", async () => {
    const order = await createOrder(IDS.userA, await createProduct(IDS.storeA), 1);
    await startCheckout(IDS.userA, order.id);
    await expireOrderPayment(order.id);
    const result = await sweepOrdersAndCheckouts();
    expect(result).toEqual({ expired_orders: 1, expired_sessions: 1 });
    expect(fake.expire).toHaveBeenCalledWith("cs_test_1");
    expect((await payments(order.id))[0].status).toBe("cancelled");
  });
});
