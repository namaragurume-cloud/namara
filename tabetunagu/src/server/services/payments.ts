import "server-only";
import type Stripe from "stripe";
import { AppError } from "@/lib/errors";
import { pickupPhase, pickupWindow, type PickupPhase } from "@/lib/monitor";
import { ORDER_POLICY, type OrderStatus } from "@/lib/orders";
import { asService, asUser } from "../db";
import { env } from "../env";
import { getStripe } from "../stripe/client";
import { cancelPendingOrder, createOrder, grantOrderPoints, sweepOrders } from "./orders";

/**
 * v2 事前決済（Stripe Checkout + Connect の destination charge）。
 *
 * - 1注文 = 1店舗 = 1 Checkout Session。ユーザーの支払額は orders.total（商品小計 + つなぐチャージ）。
 * - application_fee_amount = orders.platform_fee_total（成約手数料 + つなぐチャージ）。
 *   店舗（接続アカウント）に残るのは 小計 − 成約手数料。つなぐチャージは店舗に送金しない。
 * - 金額はすべて DB（orders / order_items）から読み直す。リクエストや Stripe の metadata は金額計算に使わない。
 * - 注文を paid にするのは Webhook（payment_intent.succeeded）だけ。success_url に戻っただけでは paid にしない。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (value: unknown) => (typeof value === "string" && UUID_RE.test(value) ? value : null);

/** Stripe Checkout Session の有効期間（Stripe の下限は30分。注文の決済待ち期限より長いため、期限後の決済は自動返金する） */
const CHECKOUT_SESSION_TTL_SECONDS = 31 * 60;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

// ---------------------------------------------------------------------------
// 決済開始
// ---------------------------------------------------------------------------

type CheckoutPaymentData =
  | { payment_id: string; reuse: true; checkout_url: string }
  | {
      payment_id: string;
      reuse: false;
      order_id: string;
      order_number: string;
      user_id: string;
      store_id: string;
      plan_code: string;
      subtotal: number;
      tsunagu_charge: number;
      total: number;
      application_fee_amount: number;
      connected_account_id: string;
      store_name: string;
      items: { product_id: string; name: string; unit_price: number; quantity: number }[];
    };

/** 店舗が決済を受け付けられるか（Connect の登録が完了し、店舗が稼働中） */
export async function isProductPurchasable(viewerId: string, productId: string) {
  if (!UUID_RE.test(productId)) return false;
  const [row] = await asUser(viewerId, (q) =>
    q.query<{ ok: boolean }>(
      `select (s.status = 'active' and s.stripe_charges_enabled) as ok
       from public.products p join public.stores s on s.id = p.store_id where p.id = $1`,
      [productId],
    ),
  );
  return Boolean(row?.ok);
}

/** 注文（pending_payment）を作成し、Stripe Checkout の URL を返す。決済を開始できなければ注文を取り消す。 */
export async function purchase(userId: string, productId: string, quantity: number) {
  getStripe(); // 決済が使えない環境では在庫を押さえない
  if (!(await isProductPurchasable(userId, productId))) throw new AppError("store_payment_unavailable");
  const order = await createOrder(userId, productId, quantity);
  try {
    return { orderId: order.id, url: await startCheckout(userId, order.id) };
  } catch (error) {
    await cancelPendingOrder(userId, order.id).catch((e) => console.error("[payments] cancel after checkout failure", e));
    throw error;
  }
}

/** 本人の決済待ちの注文について Checkout Session を作成（有効なものがあれば再利用）し、URL を返す */
export async function startCheckout(userId: string, orderId: string): Promise<string> {
  if (!UUID_RE.test(orderId)) throw new AppError("order_not_found");
  const stripe = getStripe();
  const [{ data }] = await asService((q) =>
    q.query<{ data: CheckoutPaymentData }>("select public.create_checkout_payment($1::uuid, $2::uuid) as data", [
      orderId,
      userId,
    ]),
  );
  if (data.reuse) return data.checkout_url;

  const lineTotal = data.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0) + data.tsunagu_charge;
  if (lineTotal !== data.total || data.items.length === 0) {
    await closePayment(data.payment_id, "failed", "line_items_total_mismatch");
    throw new AppError("checkout_failed");
  }

  const metadata = {
    order_id: data.order_id,
    order_number: data.order_number,
    user_id: data.user_id,
    store_id: data.store_id,
    plan_code: data.plan_code,
    payment_id: data.payment_id,
  };
  const base = env.stripe.checkoutReturnUrl;
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    locale: "ja",
    client_reference_id: data.order_id,
    line_items: [
      ...data.items.map((i) => ({
        quantity: i.quantity,
        price_data: { currency: "jpy", unit_amount: i.unit_price, product_data: { name: i.name } },
      })),
      ...(data.tsunagu_charge > 0
        ? [
            {
              quantity: 1,
              price_data: {
                currency: "jpy",
                unit_amount: data.tsunagu_charge,
                product_data: { name: "つなぐチャージ", description: "TABETUNAGU のシステム利用料（1注文ごと）" },
              },
            },
          ]
        : []),
    ],
    payment_intent_data: {
      application_fee_amount: data.application_fee_amount,
      transfer_data: { destination: data.connected_account_id },
      description: `TABETUNAGU ${data.order_number}（${data.store_name}）`,
      metadata,
    },
    metadata,
    success_url: `${base}/orders/${data.order_id}?from=checkout`,
    cancel_url: `${base}/orders/${data.order_id}?from=cancel`,
    expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_TTL_SECONDS,
    ...(env.stripe.paymentMethodConfiguration ? { payment_method_configuration: env.stripe.paymentMethodConfiguration } : {}),
  };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(params, { idempotencyKey: `tt_checkout_${data.payment_id}` });
  } catch (error) {
    console.error("[payments] checkout session create failed", error);
    await closePayment(data.payment_id, "failed", errorText(error));
    throw new AppError("checkout_failed");
  }
  if (!session.url) {
    await closePayment(data.payment_id, "failed", "checkout_session_without_url");
    throw new AppError("checkout_failed");
  }
  await asService((q) =>
    q.query("select public.attach_checkout_session($1::uuid, $2, $3, $4)", [
      data.payment_id,
      session.id,
      session.url,
      new Date(session.expires_at * 1000).toISOString(),
    ]),
  );
  return session.url;
}

async function closePayment(paymentId: string, status: "failed" | "cancelled", reason: string) {
  await asService((q) => q.query("select public.close_checkout_payment($1::uuid, $2, $3)", [paymentId, status, reason]));
}

/**
 * 決済期限切れの注文を閉じ（sweep_orders）、その注文の開いたままの Checkout Session も Stripe 側で期限切れにする。
 * 期限切れにする前に支払われていた場合は、Webhook で自動返金される。
 */
export async function sweepOrdersAndCheckouts() {
  const swept = await sweepOrders();
  let expiredSessions = 0;
  if (env.stripe.enabled) {
    const stripe = getStripe();
    const rows = await asService((q) =>
      q.query<{ payment_id: string; checkout_session_id: string }>("select * from public.stale_checkout_sessions(50)"),
    );
    for (const row of rows) {
      try {
        await stripe.checkout.sessions.expire(row.checkout_session_id);
      } catch (error) {
        // 既に完了・期限切れのセッションは expire できない（完了していれば Webhook 側で返金される）
        console.warn("[payments] checkout session expire failed", row.checkout_session_id, errorText(error));
      }
      await closePayment(row.payment_id, "cancelled", "order_closed");
      expiredSessions++;
    }
  }
  return { ...swept, expired_sessions: expiredSessions };
}

// ---------------------------------------------------------------------------
// 注文の表示
// ---------------------------------------------------------------------------

export type MyOrderView = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  tsunaguCharge: number;
  total: number;
  pickupStartAt: string;
  pickupEndAt: string;
  paymentExpiresAt: string;
  paidAt: string | null;
  pickedUpAt: string | null;
  storeId: string;
  storeName: string;
  storeAddress: string;
  productId: string | null;
  items: { name: string; unitPrice: number; quantity: number; lineTotal: number }[];
  /** 最新の決済試行の状態 */
  paymentStatus: string | null;
  /** 最新の返金の状態 */
  refundStatus: string | null;
  /** 最新の返金の金額・日時（成功した日時。未完了なら受付日時）。表示用 */
  refundAmount: number | null;
  refundAt: string | null;
  /** まだ支払える（決済待ちで期限内） */
  payable: boolean;
  /** お客様都合で全額返金できる（決済から一定時間内かつ受取開始前） */
  userRefundable: boolean;
  /** 受取の区分（決済済み以降のみ） */
  phase: PickupPhase | null;
  /** 受取完了（スワイプ）できる時間帯 */
  pickupOpensAt: string;
  pickupClosesAt: string;
};

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export async function getMyOrder(userId: string, orderId: string, now = new Date()): Promise<MyOrderView | null> {
  if (!UUID_RE.test(orderId)) return null;
  return asUser(userId, async (q) => {
    const [o] = await q.query<Record<string, unknown>>(
      `select o.id, o.order_number, o.status::text as status, o.subtotal, o.tsunagu_charge, o.total, o.pickup_start,
              o.pickup_end, o.payment_expires_at, o.paid_at, o.picked_up_at, o.store_id, s.name as store_name,
              s.address as store_address
       from public.orders o join public.stores s on s.id = o.store_id
       where o.id = $1 and o.user_id = $2`,
      [orderId, userId],
    );
    if (!o) return null;
    const items = await q.query<{ product_id: string; product_name_snapshot: string; unit_price: number; quantity: number; line_total: number }>(
      "select product_id, product_name_snapshot, unit_price, quantity, line_total from public.order_items where order_id = $1 order by created_at",
      [orderId],
    );
    const [payment] = await q.query<{ status: string }>(
      "select status from public.payments where order_id = $1 order by created_at desc limit 1",
      [orderId],
    );
    const [refund] = await q.query<{ status: string; amount: number; at: string }>(
      "select status, amount, coalesce(succeeded_at, created_at) as at from public.refunds where order_id = $1 order by created_at desc limit 1",
      [orderId],
    );
    const status = o.status as OrderStatus;
    const paidAt = iso(o.paid_at);
    const pickupStartAt = iso(o.pickup_start)!;
    const paymentExpiresAt = iso(o.payment_expires_at)!;
    const t = now.getTime();
    const pickupEndAt = iso(o.pickup_end)!;
    const window = pickupWindow(pickupStartAt, pickupEndAt);
    return {
      id: String(o.id),
      orderNumber: String(o.order_number),
      status,
      subtotal: Number(o.subtotal),
      tsunaguCharge: Number(o.tsunagu_charge),
      total: Number(o.total),
      pickupStartAt,
      pickupEndAt,
      paymentExpiresAt,
      paidAt,
      pickedUpAt: iso(o.picked_up_at),
      storeId: String(o.store_id),
      storeName: String(o.store_name),
      storeAddress: String(o.store_address ?? ""),
      productId: items[0]?.product_id ?? null,
      items: items.map((i) => ({
        name: i.product_name_snapshot,
        unitPrice: Number(i.unit_price),
        quantity: Number(i.quantity),
        lineTotal: Number(i.line_total),
      })),
      paymentStatus: payment?.status ?? null,
      refundStatus: refund?.status ?? null,
      refundAmount: refund ? Number(refund.amount) : null,
      refundAt: refund ? iso(refund.at) : null,
      payable: status === "pending_payment" && Date.parse(paymentExpiresAt) > t,
      userRefundable:
        status === "paid" &&
        paidAt !== null &&
        t <= Date.parse(paidAt) + ORDER_POLICY.userRefundWindowMinutes * 60_000 &&
        t < Date.parse(pickupStartAt),
      phase:
        status === "paid" || status === "picked_up" || status === "unclaimed"
          ? pickupPhase({ status, pickupStartAt, pickupEndAt }, t)
          : null,
      pickupOpensAt: new Date(window.opensAt).toISOString(),
      pickupClosesAt: new Date(window.closesAt).toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// 返金
// ---------------------------------------------------------------------------

export type RefundActor = "user" | "store" | "admin" | "system";

export type RefundResult = { refund_id: string; status: "succeeded" | "pending" | "failed"; already: boolean };

/**
 * 全額返金。返金ポリシー（本人・時間・権限）の確認と記録は DB（begin_refund / complete_refund）、
 * Stripe Refund の作成はここで行う。同じ返金は冪等キーで Stripe 側でも1回だけ作られる。
 * destination charge のため、店舗への送金（reverse_transfer）とプラットフォーム手数料（refund_application_fee）も戻す。
 */
export async function refundOrder(input: {
  orderId: string;
  actor: RefundActor;
  reason: string;
  requestedBy?: string | null;
  /** 注文に使われなかった決済（期限切れ後の決済・二重決済）だけを返金するとき */
  paymentId?: string | null;
}): Promise<RefundResult> {
  if (!UUID_RE.test(input.orderId)) throw new AppError("order_not_found");
  const stripe = getStripe();
  const [{ data: begun }] = await asService((q) =>
    q.query<{ data: { refund_id: string; payment_intent: string | null; amount: number; resumed: boolean } }>(
      "select public.begin_refund($1::uuid, $2::public.cancel_actor, $3, $4::uuid, $5::uuid) as data",
      [input.orderId, input.actor, input.reason, input.requestedBy ?? null, input.paymentId ?? null],
    ),
  );
  const fail = (reason: string) =>
    asService((q) => q.query("select public.fail_refund($1::uuid, $2)", [begun.refund_id, reason]));
  if (!begun.payment_intent) {
    await fail("missing_payment_intent");
    throw new AppError("refund_failed");
  }

  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: begun.payment_intent,
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: { order_id: input.orderId, refund_id: begun.refund_id, actor: input.actor },
      },
      { idempotencyKey: `tt_refund_${begun.refund_id}` },
    );
  } catch (error) {
    console.error("[payments] refund create failed", error);
    await fail(errorText(error));
    throw new AppError("refund_failed");
  }

  const [{ data }] = await asService((q) =>
    q.query<{ data: RefundResult }>("select public.complete_refund($1::uuid, $2, $3) as data", [
      begun.refund_id,
      refund.id,
      refund.status ?? "pending",
    ]),
  );
  if (data.status === "failed") throw new AppError("refund_failed");
  return data;
}

/** お客様都合のキャンセル・返金（決済から一定時間内かつ受取開始前） */
export function requestUserRefund(userId: string, orderId: string) {
  return refundOrder({ orderId, actor: "user", reason: "user_cancel", requestedBy: userId });
}

/** 店舗都合のキャンセル・返金（理由必須。在庫は戻さない） */
export function storeRefundOrder(userId: string, orderId: string, reason: string) {
  return refundOrder({ orderId, actor: "store", reason, requestedBy: userId });
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/**
 * Stripe のイベントを処理する（署名検証済みであること）。
 * payment_events に event.id を記録してから処理し、同じイベントは2回処理しない。
 * 処理に失敗したら例外を投げる（Webhook は 500 を返し、Stripe の再送で再処理される）。
 */
export async function processStripeEvent(event: Stripe.Event) {
  const object = event.data.object as { id?: string; object?: string };
  // 個人情報（メールアドレス・住所など）は保存しない
  const payload = { object: object.object ?? null, id: object.id ?? null, livemode: event.livemode, created: event.created };
  const [{ claim }] = await asService((q) =>
    q.query<{ claim: "claimed" | "duplicate" | "in_progress" }>(
      "select public.claim_payment_event('stripe', $1, $2, $3::jsonb) as claim",
      [event.id, event.type, JSON.stringify(payload)],
    ),
  );
  if (claim !== "claimed") return { status: claim };

  const finish = (error: string | null) =>
    asService((q) => q.query("select public.finish_payment_event('stripe', $1, $2)", [event.id, error]));
  try {
    const result = await handleStripeEvent(event);
    await finish(null);
    return { status: "processed" as const, result };
  } catch (error) {
    await finish(errorText(error)).catch((e) => console.error("[payments] finish_payment_event failed", e));
    throw error;
  }
}

async function handleStripeEvent(event: Stripe.Event): Promise<Record<string, unknown>> {
  switch (event.type) {
    // 注文を paid にするのは payment_intent.succeeded だけ（カード・非同期決済のどちらでも最後に必ず届く）
    case "payment_intent.succeeded":
      return onPaymentIntentSucceeded(event.data.object);
    case "payment_intent.payment_failed":
      return onPaymentIntentFailed(event.data.object);
    // Checkout 側のイベントは PaymentIntent ID の記録・試行の終了のみ（paid にはしない）
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
      return onCheckoutSessionEvent(event.data.object);
    case "checkout.session.expired":
      return onCheckoutSessionExpired(event.data.object);
    case "charge.refunded":
      return onChargeRefunded(event.data.object);
    case "account.updated":
      return onAccountUpdated(event.data.object);
    // 処理中（pending）の返金の確定・失敗
    case "refund.updated":
    case "refund.failed":
    case "charge.refund.updated":
      return onRefundUpdated(event.data.object);
    default:
      return { ignored: true };
  }
}

const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : (value?.id ?? null));

async function onPaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  const md = pi.metadata ?? {};
  const [{ data }] = await asService((q) =>
    q.query<{ data: { result: string; order_id?: string; payment_id?: string } }>(
      "select public.mark_order_paid($1::uuid, $2, $3::int, $4, $5, $6::int, $7::uuid, $8::uuid) as data",
      [
        uuidOrNull(md.payment_id),
        pi.id,
        pi.amount_received,
        pi.currency,
        idOf(pi.transfer_data?.destination),
        pi.application_fee_amount ?? null,
        uuidOrNull(md.order_id),
        uuidOrNull(md.store_id),
      ],
    ),
  );

  if ((data.result === "paid" || data.result === "already_paid") && data.order_id) {
    // ポイントは決済とは別のトランザクション。失敗しても paid は戻さず、Webhook の再送で付与し直す（冪等）
    try {
      const points = await grantOrderPoints(data.order_id);
      return { ...data, points };
    } catch (error) {
      // 再送が届いた時点で注文が受取済み・返金済みなど paid でなくなっていれば、付与はもう行わない（再送を止める）
      if (data.result === "already_paid" && error instanceof AppError && error.code === "order_not_paid") {
        return { ...data, points: "skipped_order_not_paid" };
      }
      throw error;
    }
  }
  if (data.result === "requires_refund" && data.order_id && data.payment_id) {
    try {
      const refund = await refundOrder({
        orderId: data.order_id,
        paymentId: data.payment_id,
        actor: "system",
        reason: "payment_after_order_closed",
      });
      return { ...data, refund };
    } catch (error) {
      if (error instanceof AppError && error.code === "already_refunded") return { ...data, refund: "already_refunded" };
      throw error;
    }
  }
  return data;
}

async function onPaymentIntentFailed(pi: Stripe.PaymentIntent) {
  const paymentId = uuidOrNull(pi.metadata?.payment_id);
  if (!paymentId) return { ignored: true };
  const reason = pi.last_payment_error?.code ?? pi.last_payment_error?.type ?? "payment_failed";
  await asService((q) => q.query("select public.note_payment_failure($1::uuid, $2, $3)", [paymentId, pi.id, reason]));
  return { noted: true };
}

async function onCheckoutSessionEvent(session: Stripe.Checkout.Session) {
  const pi = idOf(session.payment_intent);
  if (!pi) return { ignored: true };
  await asService((q) => q.query("select public.link_checkout_payment_intent($1, $2)", [session.id, pi]));
  return { linked: true };
}

async function onCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  const paymentId = uuidOrNull(session.metadata?.payment_id);
  if (!paymentId) return { ignored: true };
  await closePayment(paymentId, "cancelled", "checkout_session_expired");
  return { closed: true };
}

async function onChargeRefunded(charge: Stripe.Charge) {
  const pi = idOf(charge.payment_intent);
  if (!pi) return { ignored: true };
  const [{ data }] = await asService((q) =>
    q.query<{ data: Record<string, unknown> }>("select public.sync_charge_refunded($1, $2::int) as data", [
      pi,
      charge.amount_refunded,
    ]),
  );
  return data;
}

async function onAccountUpdated(account: Stripe.Account) {
  const [{ store_id }] = await asService((q) =>
    q.query<{ store_id: string | null }>("select public.sync_stripe_account($1, $2, $3, $4) as store_id", [
      account.id,
      Boolean(account.charges_enabled),
      Boolean(account.payouts_enabled),
      Boolean(account.details_submitted),
    ]),
  );
  return { store_id };
}

async function onRefundUpdated(refund: Stripe.Refund) {
  const [{ data }] = await asService((q) =>
    q.query<{ data: Record<string, unknown> }>("select public.sync_refund_status($1, $2, $3) as data", [
      refund.id,
      refund.status ?? "pending",
      refund.failure_reason ?? null,
    ]),
  );
  return data;
}
