import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/stripe/webhook/route";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { createOrder, getPointsBalance, sweepOrders } from "@/server/services/orders";
import { startCheckout } from "@/server/services/payments";
import { createProduct, createTestDb, expireOrderPayment, getOrder, getProduct, IDS } from "./support/db";
import {
  connectStore,
  installFakeStripe,
  paymentSucceededFrom,
  signedWebhookRequest,
  stripeEvent,
  uninstallFakeStripe,
  type FakeStripe,
} from "./support/stripe";

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

const send = (event: Parameters<typeof signedWebhookRequest>[1]) => POST(signedWebhookRequest(fake.stripe, event));

async function checkoutFor(userId: string, opts: Parameters<typeof createProduct>[1] = {}, storeId: string = IDS.storeA) {
  const productId = await createProduct(storeId, opts);
  const order = await createOrder(userId, productId, 1);
  await startCheckout(userId, order.id);
  return { order, productId, call: fake.sessions.at(-1)! };
}

const paymentRows = (orderId: string) =>
  asService((q) =>
    q.query<{ status: string; provider_payment_id: string | null; failure_reason: string | null }>(
      "select status, provider_payment_id, failure_reason from public.payments where order_id = $1 order by created_at",
      [orderId],
    ),
  );
const pointRows = (userId: string) =>
  asService((q) => q.query<{ type: string; amount: number }>("select type, amount from public.points_transactions where user_id = $1", [userId]));

describe("Stripe Webhook: 署名検証", () => {
  it("署名が不正なリクエストは 400 で拒否し、何も処理しない", async () => {
    const { order, call } = await checkoutFor(IDS.userA);
    const event = paymentSucceededFrom(call, "pi_bad");
    const forged = signedWebhookRequest(fake.stripe, event, "whsec_attackerSecret");
    const res = await POST(forged);
    expect(res.status).toBe(400);
    expect((await getOrder(order.id)).status).toBe("pending_payment");

    const unsigned = new Request("http://localhost/api/stripe/webhook", { method: "POST", body: JSON.stringify(event) });
    expect((await POST(unsigned)).status).toBe(400);

    // 本文を改ざんすると署名が合わない
    const tampered = signedWebhookRequest(fake.stripe, event);
    const body = (await tampered.text()).replace('"amount_received":830', '"amount_received":1');
    const res2 = await POST(new Request(tampered.url, { method: "POST", headers: tampered.headers, body }));
    expect(res2.status).toBe(400);
    const [{ count }] = await asService((q) => q.query<{ count: number }>("select count(*)::int as count from public.payment_events"));
    expect(count).toBe(0);
  });

  it("Webhook 署名鍵が未設定なら 503（処理しない）", async () => {
    const { call } = await checkoutFor(IDS.userA);
    const req = signedWebhookRequest(fake.stripe, paymentSucceededFrom(call, "pi_x"));
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await POST(req)).status).toBe(503);
  });
});

describe("Stripe Webhook: 決済成功", () => {
  it("payment_intent.succeeded で注文が paid になり、30pt が付与される", async () => {
    const { order, call } = await checkoutFor(IDS.userA);
    const res = await send(paymentSucceededFrom(call, "pi_ok"));
    expect(res.status).toBe(200);
    const row = await getOrder(order.id);
    expect(row.status).toBe("paid");
    expect(row.paid_at).not.toBeNull();
    expect((await paymentRows(order.id))[0]).toMatchObject({ status: "succeeded", provider_payment_id: "pi_ok" });
    expect(await getPointsBalance(IDS.userA)).toBe(30);
  });

  it("success URL に戻っただけ・checkout.session.completed だけでは paid にしない", async () => {
    const { order, call } = await checkoutFor(IDS.userA);
    const res = await send(
      stripeEvent("checkout.session.completed", {
        id: "cs_test_1",
        object: "checkout.session",
        payment_status: "paid",
        payment_intent: "pi_linked",
        metadata: call.params.metadata,
      }),
    );
    expect(res.status).toBe(200);
    expect((await getOrder(order.id)).status).toBe("pending_payment");
    expect((await paymentRows(order.id))[0].provider_payment_id).toBe("pi_linked");
  });

  it("同じ Webhook を何回受けても、paid・ポイント付与は1回だけ", async () => {
    const { order, call } = await checkoutFor(IDS.userA);
    const event = paymentSucceededFrom(call, "pi_dup");
    for (let i = 0; i < 3; i++) expect((await send(event)).status).toBe(200);
    // 同時に届いても1回だけ
    await Promise.all([send(event), send(event)]);
    expect((await getOrder(order.id)).status).toBe("paid");
    expect(await pointRows(IDS.userA)).toEqual([{ type: "earned", amount: 30 }]);
    const [{ count, processed }] = await asService((q) =>
      q.query<{ count: number; processed: boolean }>(
        "select count(*)::int as count, bool_and(processed_at is not null) as processed from public.payment_events where provider_event_id = $1",
        [event.id],
      ),
    );
    expect(count).toBe(1);
    expect(processed).toBe(true);

    // 別のイベント ID で同じ PaymentIntent の成功が届いても、二重には処理しない
    expect((await send(paymentSucceededFrom(call, "pi_dup"))).status).toBe(200);
    expect(await pointRows(IDS.userA)).toHaveLength(1);
  });

  it("受取済みになった後に同じ決済成功が再送されても 200 で終わり、何も変えない", async () => {
    const { order, call } = await checkoutFor(IDS.userA);
    expect((await send(paymentSucceededFrom(call, "pi_late_resend"))).status).toBe(200);
    await asService((q) => q.query("update public.orders set status = 'picked_up' where id = $1", [order.id]));
    expect((await send(paymentSucceededFrom(call, "pi_late_resend"))).status).toBe(200);
    expect((await getOrder(order.id)).status).toBe("picked_up");
    expect(await pointRows(IDS.userA)).toEqual([{ type: "earned", amount: 30 }]);
  });

  it("金額が注文と一致しない決済では paid にしない（要確認）", async () => {
    const { order, call } = await checkoutFor(IDS.userA, { price: 800 });
    await send(paymentSucceededFrom(call, "pi_amount", { amount: 1, amount_received: 1 }));
    expect((await getOrder(order.id)).status).toBe("pending_payment");
    const [p] = await paymentRows(order.id);
    expect(p.status).toBe("requires_review");
    expect(p.failure_reason).toContain("amount_mismatch");
    expect(await getPointsBalance(IDS.userA)).toBe(0);
  });

  it("店舗（metadata / 送金先）が注文と一致しない決済では paid にしない", async () => {
    const a = await checkoutFor(IDS.userA);
    await send(paymentSucceededFrom(a.call, "pi_store", { metadata: { ...a.call.params.metadata, store_id: IDS.storeB } }));
    expect((await getOrder(a.order.id)).status).toBe("pending_payment");
    expect((await paymentRows(a.order.id))[0].failure_reason).toContain("store_mismatch");

    const b = await checkoutFor(IDS.userB);
    await send(paymentSucceededFrom(b.call, "pi_dest", { transfer_data: { destination: "acct_storeB" } }));
    expect((await getOrder(b.order.id)).status).toBe("pending_payment");
    expect((await paymentRows(b.order.id))[0].failure_reason).toContain("destination_mismatch");
  });

  it("手数料（application_fee_amount）が注文と一致しない決済では paid にしない", async () => {
    const { order, call } = await checkoutFor(IDS.userA);
    await send(paymentSucceededFrom(call, "pi_fee", { application_fee_amount: 0 }));
    expect((await getOrder(order.id)).status).toBe("pending_payment");
    expect((await paymentRows(order.id))[0].failure_reason).toContain("application_fee_mismatch");
  });

  it("この注文システム以外の決済は無視する（200）", async () => {
    const res = await send(
      stripeEvent("payment_intent.succeeded", {
        id: "pi_other",
        object: "payment_intent",
        amount: 500,
        amount_received: 500,
        currency: "jpy",
        metadata: {},
      }),
    );
    expect(res.status).toBe(200);
  });

  it("ポイント付与が失敗しても paid は戻さず、再送で付与し直す", async () => {
    const { order, call } = await checkoutFor(IDS.userA);
    const event = paymentSucceededFrom(call, "pi_points");
    await asService((q) => q.query("update public.platform_settings set int_value = 0 where key = 'order_points'"));
    expect((await send(event)).status).toBe(500); // 0pt の earned は符号チェックで拒否される
    expect((await getOrder(order.id)).status).toBe("paid");
    expect(await getPointsBalance(IDS.userA)).toBe(0);

    await asService((q) => q.query("update public.platform_settings set int_value = 30 where key = 'order_points'"));
    expect((await send(event)).status).toBe(200);
    expect(await getPointsBalance(IDS.userA)).toBe(30);
  });
});

describe("決済期限切れとの競合", () => {
  it("期限切れで cancelled になった注文に決済成功が届いても paid にせず、全額返金する（在庫は二重に戻さない）", async () => {
    const { order, productId, call } = await checkoutFor(IDS.userA, { quantity: 1 });
    expect((await getProduct(productId)).remaining_quantity).toBe(0);
    await expireOrderPayment(order.id);
    await sweepOrders();
    expect((await getOrder(order.id)).status).toBe("cancelled");
    expect((await getProduct(productId)).remaining_quantity).toBe(1);

    const event = paymentSucceededFrom(call, "pi_late");
    expect((await send(event)).status).toBe(200);
    expect((await getOrder(order.id)).status).toBe("cancelled");
    expect(fake.refunds).toHaveLength(1);
    expect(fake.refunds[0].params).toMatchObject({ payment_intent: "pi_late", reverse_transfer: true, refund_application_fee: true });
    expect((await paymentRows(order.id))[0].status).toBe("refunded");
    const [refund] = await asService((q) =>
      q.query<{ status: string; actor: string; scope: string; restock: boolean }>(
        "select status, actor::text, scope, restock from public.refunds where order_id = $1",
        [order.id],
      ),
    );
    expect(refund).toEqual({ status: "succeeded", actor: "system", scope: "payment", restock: false });
    expect((await getProduct(productId)).remaining_quantity).toBe(1); // 二重に戻さない
    expect(await getPointsBalance(IDS.userA)).toBe(0);

    // 再送されても返金は1回だけ
    expect((await send(paymentSucceededFrom(call, "pi_late"))).status).toBe(200);
    expect(fake.refunds).toHaveLength(1);
    const [{ count }] = await asService((q) =>
      q.query<{ count: number }>("select count(*)::int as count from public.refunds where order_id = $1", [order.id]),
    );
    expect(count).toBe(1);
  });

  it("期限は過ぎたがまだ sweep されていない注文は、そのまま paid にする", async () => {
    const { order, call } = await checkoutFor(IDS.userA);
    await expireOrderPayment(order.id);
    await send(paymentSucceededFrom(call, "pi_unswept"));
    expect((await getOrder(order.id)).status).toBe("paid");
    expect((await sweepOrders()).expired_orders).toBe(0);
  });

  it("同じ注文が2回決済されたら、2回目の決済を全額返金する", async () => {
    const { order, call } = await checkoutFor(IDS.userA);
    // 1つ目の Checkout Session を期限切れ扱いにして、2つ目を作る
    await asService((q) => q.query("update public.payments set checkout_expires_at = now() where order_id = $1", [order.id]));
    await startCheckout(IDS.userA, order.id);
    const call2 = fake.sessions.at(-1)!;
    await send(paymentSucceededFrom(call, "pi_first"));
    await send(paymentSucceededFrom(call2, "pi_second"));
    expect((await getOrder(order.id)).status).toBe("paid");
    expect(fake.refunds.map((r) => r.params.payment_intent)).toEqual(["pi_second"]);
    expect((await paymentRows(order.id)).map((p) => p.status).sort()).toEqual(["refunded", "succeeded"]);
    expect(await getPointsBalance(IDS.userA)).toBe(30);
  });
});

describe("その他のイベント", () => {
  it("account.updated で店舗の Connect 情報を同期する", async () => {
    await asService((q) =>
      q.query(
        "update public.stores set stripe_charges_enabled = false, stripe_payouts_enabled = false, stripe_details_submitted = false where id = $1",
        [IDS.storeA],
      ),
    );
    await send(
      stripeEvent("account.updated", {
        id: "acct_storeA",
        object: "account",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      }),
    );
    const [s] = await asService((q) =>
      q.query<Record<string, unknown>>(
        "select stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, stripe_onboarding_completed_at is not null as completed from public.stores where id = $1",
        [IDS.storeA],
      ),
    );
    expect(s).toEqual({ stripe_charges_enabled: true, stripe_payouts_enabled: true, stripe_details_submitted: true, completed: true });
  });

  it("charge.refunded（Stripe ダッシュボードからの全額返金）を注文に反映する", async () => {
    const { order, call } = await checkoutFor(IDS.userA);
    await send(paymentSucceededFrom(call, "pi_dash"));
    await send(
      stripeEvent("charge.refunded", { id: "ch_1", object: "charge", payment_intent: "pi_dash", amount: 830, amount_refunded: 830 }),
    );
    expect((await getOrder(order.id)).status).toBe("refunded");
    expect(await getPointsBalance(IDS.userA)).toBe(0);
    expect(fake.refunds).toHaveLength(0); // Stripe 側で返金済みなので API は呼ばない
  });

  it("checkout.session.expired で決済試行を閉じる（注文は決済待ちのまま）", async () => {
    const { order, call } = await checkoutFor(IDS.userA);
    await send(stripeEvent("checkout.session.expired", { id: "cs_test_1", object: "checkout.session", metadata: call.params.metadata }));
    expect((await paymentRows(order.id))[0].status).toBe("cancelled");
    expect((await getOrder(order.id)).status).toBe("pending_payment");
  });
});
