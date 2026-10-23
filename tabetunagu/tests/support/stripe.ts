import Stripe from "stripe";
import { vi } from "vitest";
import { asService } from "@/server/db";
import { processStripeEvent, startCheckout } from "@/server/services/payments";
import { setStripeForTesting } from "@/server/stripe/client";
import { createOrder } from "@/server/services/orders";
import { createProduct } from "./db";

export const TEST_SECRET_KEY = "sk_test_unitTestDummyKey";
export const TEST_WEBHOOK_SECRET = "whsec_unitTestWebhookSecret";

type SessionCall = { params: Stripe.Checkout.SessionCreateParams; idempotencyKey?: string };
type RefundCall = { params: Stripe.RefundCreateParams; idempotencyKey?: string };

/**
 * Stripe API に通信しない Stripe クライアント。
 * 署名検証（webhooks）は SDK の実装をそのまま使い、通信するメソッドはすべてモックに置き換える。
 * 万一モックしていない API を呼んでも外部には出ないよう、接続先は閉じたローカルポートにしてある。
 */
export function installFakeStripe() {
  process.env.STRIPE_SECRET_KEY = TEST_SECRET_KEY;
  process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  const stripe = new Stripe(TEST_SECRET_KEY, { host: "127.0.0.1", port: 9, protocol: "http", maxNetworkRetries: 0, timeout: 500 });

  let seq = 0;
  const sessions: SessionCall[] = [];
  const refunds: RefundCall[] = [];
  const refundByKey = new Map<string, Stripe.Refund>();
  const accounts = new Map<string, Stripe.Account>();
  const state = {
    sessionError: null as Error | null,
    refundError: null as Error | null,
    refundStatus: "succeeded" as Stripe.Refund["status"],
  };

  const mock = <T>(target: object, key: string, impl: (...args: never[]) => unknown) => {
    const fn = vi.fn(impl);
    (target as Record<string, unknown>)[key] = fn;
    return fn as unknown as T;
  };

  mock(stripe.checkout.sessions, "create", async (params: Stripe.Checkout.SessionCreateParams, opts?: Stripe.RequestOptions) => {
    if (state.sessionError) throw state.sessionError;
    sessions.push({ params, idempotencyKey: opts?.idempotencyKey });
    const id = `cs_test_${++seq}`;
    return { id, object: "checkout.session", url: `https://checkout.stripe.com/c/pay/${id}`, expires_at: params.expires_at };
  });
  const expire = mock(stripe.checkout.sessions, "expire", async (id: string) => ({ id, status: "expired" }));

  mock(stripe.refunds, "create", async (params: Stripe.RefundCreateParams, opts?: Stripe.RequestOptions) => {
    if (state.refundError) throw state.refundError;
    refunds.push({ params, idempotencyKey: opts?.idempotencyKey });
    const key = opts?.idempotencyKey ?? `auto_${seq}`;
    const existing = refundByKey.get(key);
    if (existing) return existing; // Stripe の冪等キーと同じ振る舞い
    const refund = { id: `re_test_${++seq}`, object: "refund", status: state.refundStatus, payment_intent: params.payment_intent } as Stripe.Refund;
    refundByKey.set(key, refund);
    return refund;
  });

  mock(stripe.accounts, "create", async (params: Stripe.AccountCreateParams) => {
    const account = { id: `acct_test${++seq}`, object: "account", charges_enabled: false, payouts_enabled: false, details_submitted: false, metadata: params.metadata } as Stripe.Account;
    accounts.set(account.id, account);
    return account;
  });
  mock(stripe.accounts, "retrieve", async (id: string) => accounts.get(id) ?? { id, object: "account", charges_enabled: true, payouts_enabled: true, details_submitted: true });
  mock(stripe.accountLinks, "create", async (params: Stripe.AccountLinkCreateParams) => ({
    object: "account_link",
    url: `https://connect.stripe.com/setup/e/${params.account}/test`,
  }));

  setStripeForTesting(stripe);
  return { stripe, sessions, refunds, accounts, expire, state };
}

export type FakeStripe = ReturnType<typeof installFakeStripe>;

export function uninstallFakeStripe() {
  setStripeForTesting(undefined);
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
}

/** 店舗の Connect 登録を完了済みにする */
export async function connectStore(storeId: string, accountId: string) {
  await asService((q) =>
    q.query(
      `update public.stores set stripe_account_id = $2, stripe_charges_enabled = true, stripe_payouts_enabled = true,
         stripe_details_submitted = true where id = $1`,
      [storeId, accountId],
    ),
  );
}

let eventSeq = 0;
export function stripeEvent<T extends Stripe.Event["type"]>(type: T, object: Record<string, unknown>, id?: string): Stripe.Event {
  return {
    id: id ?? `evt_test_${++eventSeq}_${Date.now()}`,
    object: "event",
    type,
    api_version: "2026-09-30.endive",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: { object },
  } as unknown as Stripe.Event;
}

/** checkout の呼び出しから、Stripe が返す payment_intent.succeeded を組み立てる */
export function paymentSucceededFrom(call: SessionCall, piId: string, overrides: Record<string, unknown> = {}) {
  const pid = call.params.payment_intent_data!;
  const amount = call.params.line_items!.reduce((s, li) => s + (li.price_data!.unit_amount as number) * (li.quantity as number), 0);
  return stripeEvent("payment_intent.succeeded", {
    id: piId,
    object: "payment_intent",
    amount,
    amount_received: amount,
    currency: "jpy",
    status: "succeeded",
    application_fee_amount: pid.application_fee_amount,
    transfer_data: { destination: pid.transfer_data!.destination },
    metadata: pid.metadata,
    ...overrides,
  });
}

/** Stripe の署名付き Webhook リクエスト */
export function signedWebhookRequest(stripe: Stripe, event: Stripe.Event, secret = TEST_WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: payload,
  });
}

/** 注文 → Checkout → payment_intent.succeeded まで進めた paid の注文 */
export async function createPaidOrder(
  fake: FakeStripe,
  userId: string,
  storeId: string,
  productOpts: Parameters<typeof createProduct>[1] = {},
) {
  const productId = await createProduct(storeId, productOpts);
  const order = await createOrder(userId, productId, 1);
  await startCheckout(userId, order.id);
  const call = fake.sessions.at(-1)!;
  const piId = `pi_test_${order.id.slice(0, 8)}`;
  await processStripeEvent(paymentSucceededFrom(call, piId));
  return { order, productId, call, piId, paymentId: String(call.params.metadata!.payment_id) };
}
