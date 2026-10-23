import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enterFullscreen, leaveFullscreen, releaseWakeLock, requestWakeLock } from "@/components/monitor/kiosk";
import { features, v2Readiness } from "@/lib/features";
import { storeReadiness } from "@/lib/readiness";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { cronState, CRON_STALE_MINUTES, getOpsReadiness, listRecentUnclaimed, listRequiresReview, toCsv } from "@/server/services/ops";
import { createOrder } from "@/server/services/orders";
import { processStripeEvent, requestUserRefund } from "@/server/services/payments";
import { getStoreReadiness } from "@/server/services/readiness";
import { cancellationSummary, getPolicySettings } from "@/server/services/settings";
import { createProduct, createTestDb, getOrder, IDS, setOrderStatus, shiftOrderWindow } from "./support/db";
import { connectStore, createPaidOrder, installFakeStripe, stripeEvent, uninstallFakeStripe, type FakeStripe } from "./support/stripe";

const session = vi.hoisted(() => ({ userId: null as string | null, admin: false }));
vi.mock("@/server/auth/viewer", () => ({
  getViewer: async () => (session.userId ? { id: session.userId, isAdmin: session.admin, memberships: [] } : null),
}));
const { GET: cronGET } = await import("@/app/api/cron/orders/route");
const { GET: exportGET } = await import("@/app/admin/export/route");

const ENV_KEYS = ["ENABLE_V2_CHECKOUT", "APP_ENV", "STRIPE_CHECKOUT_RETURN_URL", "CRON_SECRET"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const k of ENV_KEYS) {
    const v = k in values ? values[k] : saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

let driver: Driver | undefined;
let fake: FakeStripe;

beforeEach(async () => {
  await driver?.close();
  driver = await createTestDb();
  fake = installFakeStripe();
  await connectStore(IDS.storeA, "acct_storeA");
  session.userId = null;
  session.admin = false;
});

afterEach(() => {
  uninstallFakeStripe();
  setEnv({});
});

afterAll(async () => {
  await driver?.close();
});

describe("production の安全ガード", () => {
  it("production で ON にしても、必要な設定が欠けていれば v2 は OFF（不足項目だけを返し、値は返さない）", () => {
    setEnv({ ENABLE_V2_CHECKOUT: "true", APP_ENV: "production", STRIPE_CHECKOUT_RETURN_URL: undefined, CRON_SECRET: undefined });
    const r = v2Readiness();
    expect(r).toMatchObject({ requested: true, enforced: true, effective: false });
    expect(r.missing).toEqual(["STRIPE_CHECKOUT_RETURN_URL", "CRON_SECRET"]);
    expect(features.v2Journey).toBe(false);
    expect(features.v2CheckoutOpen).toBe(false);
    expect(JSON.stringify(r)).not.toContain("sk_test_");
  });

  it("戻り先が https でない・CRON_SECRET が短い・Stripe の鍵がない場合も不足として扱う", () => {
    setEnv({ ENABLE_V2_CHECKOUT: "true", APP_ENV: "production", STRIPE_CHECKOUT_RETURN_URL: "http://insecure.example", CRON_SECRET: "short" });
    expect(v2Readiness().missing).toEqual(["STRIPE_CHECKOUT_RETURN_URL", "CRON_SECRET"]);
    uninstallFakeStripe();
    expect(v2Readiness().missing).toContain("STRIPE_SECRET_KEY");
    expect(v2Readiness().missing).toContain("STRIPE_WEBHOOK_SECRET");
  });

  it("必要な設定がそろえば production でも ON。production 以外ではガードしない", () => {
    setEnv({ ENABLE_V2_CHECKOUT: "true", APP_ENV: "production", STRIPE_CHECKOUT_RETURN_URL: "https://app.example", CRON_SECRET: "x".repeat(32) });
    expect(v2Readiness()).toMatchObject({ effective: true, missing: [] });
    setEnv({ ENABLE_V2_CHECKOUT: "true", APP_ENV: "development", STRIPE_CHECKOUT_RETURN_URL: undefined, CRON_SECRET: undefined });
    expect(v2Readiness()).toMatchObject({ effective: true, enforced: false });
    setEnv({ ENABLE_V2_CHECKOUT: undefined, APP_ENV: "production" });
    expect(v2Readiness()).toMatchObject({ requested: false, effective: false });
  });
});

describe("定期処理（/api/cron/orders）の保護と監視", () => {
  const call = (auth?: string) =>
    cronGET(new Request("http://localhost/api/cron/orders", { headers: auth ? { authorization: auth } : {} }));

  it("CRON_SECRET が未設定なら常に拒否、不一致も拒否、正しければ実行して最終実行時刻を記録", async () => {
    setEnv({ CRON_SECRET: undefined });
    expect((await call()).status).toBe(401);
    expect((await call("Bearer anything")).status).toBe(401);

    setEnv({ CRON_SECRET: "s".repeat(32) });
    expect((await call()).status).toBe(401);
    expect((await call(`Bearer ${"t".repeat(32)}`)).status).toBe(401);
    expect((await getOpsReadiness()).cron.state).toBe("never");

    const res = await call(`Bearer ${"s".repeat(32)}`);
    expect(res.status).toBe(200);
    expect((await res.json()).result).toMatchObject({ expired_orders: 0, unclaimed_orders: 0 });
    const ops = await getOpsReadiness();
    expect(ops.cron.state).toBe("ok");
    expect(ops.cron.minutesAgo).toBe(0);
  });

  it(`最終実行から${CRON_STALE_MINUTES}分以上経つと警告`, () => {
    const now = new Date("2026-10-27T10:00:00Z");
    expect(cronState(null, now).state).toBe("never");
    expect(cronState(new Date(now.getTime() - 3 * 60_000), now)).toMatchObject({ state: "ok", minutesAgo: 3 });
    expect(cronState(new Date(now.getTime() - CRON_STALE_MINUTES * 60_000), now)).toMatchObject({ state: "stale" });
  });
});

describe("返金の状態同期（処理中 → 成功 / 失敗）", () => {
  async function pendingRefund() {
    const { order } = await createPaidOrder(fake, IDS.userA, IDS.storeA, { startIn: 30, endIn: 90 });
    fake.state.refundStatus = "pending";
    await requestUserRefund(IDS.userA, order.id);
    const [refund] = await asService((q) =>
      q.query<{ provider_refund_id: string }>("select provider_refund_id from public.refunds where order_id = $1", [order.id]),
    );
    return { order, refundId: refund.provider_refund_id };
  }
  const refundRow = (orderId: string) =>
    asService((q) =>
      q.query<{ status: string; failure_reason: string | null }>("select status, failure_reason from public.refunds where order_id = $1", [orderId]),
    ).then((r) => r[0]);

  it("refund.updated（succeeded）で返金を確定する", async () => {
    const { order, refundId } = await pendingRefund();
    expect((await refundRow(order.id)).status).toBe("pending");
    await processStripeEvent(stripeEvent("refund.updated", { id: refundId, object: "refund", status: "succeeded" }));
    expect((await refundRow(order.id)).status).toBe("succeeded");
  });

  it("refund.failed で返金を失敗にし、注文は paid に戻さず、決済を要確認にする（二重には処理しない）", async () => {
    const { order, refundId } = await pendingRefund();
    const event = stripeEvent("refund.failed", { id: refundId, object: "refund", status: "failed", failure_reason: "expired_or_canceled_card" });
    await processStripeEvent(event);
    await processStripeEvent(stripeEvent("refund.updated", { id: refundId, object: "refund", status: "failed", failure_reason: "expired_or_canceled_card" }));
    const refund = await refundRow(order.id);
    expect(refund.status).toBe("failed");
    expect(refund.failure_reason).toContain("expired_or_canceled_card");
    expect((await getOrder(order.id)).status).toBe("refunded");
    const review = await listRequiresReview();
    expect(review.map((r) => r.orderId)).toEqual([order.id]);
    expect(review[0].failureReason).toContain("refund_failed");
    const ops = await getOpsReadiness();
    expect(ops.requiresReview).toBe(1);
    expect(ops.refundsFailed).toBe(1);
    const [{ n }] = await asService((q) => q.query<{ n: number }>("select count(*)::int as n from public.events where name = 'refund_failed'"));
    expect(n).toBe(1);
  });
});

describe("管理者向けの一覧・書き出し", () => {
  it("未受取の一覧（お客様の情報は含めない）", async () => {
    const { order } = await createPaidOrder(fake, IDS.userA, IDS.storeA, { price: 900 });
    await shiftOrderWindow(order.id, -120, -60);
    await setOrderStatus(order.id, "unclaimed");
    const rows = await listRecentUnclaimed();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orderNumber: order.orderNumber, storeName: "店舗A", amount: 900, items: "テストBOX ×1" });
    expect(JSON.stringify(rows)).not.toContain(IDS.userA);
  });

  it("CSV は管理者だけが取得でき、ユーザー ID・表示名を含まない", async () => {
    await createPaidOrder(fake, IDS.userA, IDS.storeA);
    const get = (type: string) => exportGET(new Request(`http://localhost/admin/export?type=${type}&period=all`));
    expect((await get("orders")).status).toBe(404);
    session.userId = IDS.userA;
    expect((await get("orders")).status).toBe(404);
    session.userId = IDS.admin;
    session.admin = true;
    const res = await get("orders");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const csv = await res.text();
    expect(csv).toContain("order_number,store,plan,status");
    expect(csv).toContain("店舗A");
    expect(csv).not.toContain(IDS.userA);
    expect(csv).not.toContain("userA");
    expect((await get("stores")).status).toBe(200);
    expect((await get("users")).status).toBe(404);
  });

  it("CSV の値は数式として実行されないようにする", () => {
    expect(toCsv(["a"], [["=1+1"], ['x,"y"']])).toBe('a\r\n\'=1+1\r\n"x,""y"""\r\n');
  });
});

describe("店舗の導入準備", () => {
  it("公開準備の状態（未設定 → 商品準備中 → Stripe設定待ち → 公開準備OK）", () => {
    const base = { storeActive: true, hasStoreInfo: true, productCount: 1, publishedCount: 0, stripeReady: true, monitorOpened: false };
    expect(storeReadiness({ ...base, hasStoreInfo: false }).status).toBe("未設定");
    expect(storeReadiness({ ...base, storeActive: false }).status).toBe("未設定");
    expect(storeReadiness({ ...base, productCount: 0 }).status).toBe("商品準備中");
    expect(storeReadiness({ ...base, stripeReady: false }).status).toBe("Stripe設定待ち");
    const ok = storeReadiness(base);
    expect(ok.status).toBe("公開準備OK");
    expect(ok.items.find((i) => i.key === "published")!.ok).toBe(false);
  });

  it("既存データから算出する（店舗情報・商品・Stripe・公開中の商品・モニター）", async () => {
    await asService((q) =>
      q.query("update public.stores set address = '札幌', phone = '011', opening_hours = '10-20' where id = $1", [IDS.storeA]),
    );
    let r = (await getStoreReadiness([IDS.storeA, IDS.storeB]))!;
    expect(r.get(IDS.storeA)!.status).toBe("商品準備中");
    expect(r.get(IDS.storeB)!.status).toBe("未設定");
    await createProduct(IDS.storeA);
    await asService((q) =>
      q.query("insert into public.events (name, store_id) values ('monitor_opened', $1)", [IDS.storeA]),
    );
    r = await getStoreReadiness([IDS.storeA]);
    const a = r.get(IDS.storeA)!;
    expect(a.status).toBe("公開準備OK");
    expect(Object.fromEntries(a.items.map((i) => [i.key, i.ok]))).toEqual({ info: true, products: true, stripe: true, published: true, monitor: true });
  });
});

describe("キャンセルポリシーの表示（platform_settings の値）", () => {
  it("決済後の分数は DB の設定値から表示する", async () => {
    expect(cancellationSummary(await getPolicySettings())).toBe("決済後5分以内かつ受取開始前までキャンセル可能です。");
    await asService((q) => q.query("update public.platform_settings set int_value = 7 where key = 'user_refund_window_minutes'"));
    expect(cancellationSummary(await getPolicySettings())).toBe("決済後7分以内かつ受取開始前までキャンセル可能です。");
  });
});

describe("店舗モニターの全画面・画面スリープ防止（非対応環境でも壊れない）", () => {
  it("Fullscreen API がない・拒否される環境では false を返して通常表示のまま", async () => {
    expect(await enterFullscreen(null)).toBe(false);
    expect(await enterFullscreen({})).toBe(false);
    expect(await enterFullscreen({ requestFullscreen: () => Promise.reject(new Error("denied")) })).toBe(false);
    expect(await enterFullscreen({ requestFullscreen: () => Promise.resolve() })).toBe(true);
    await expect(leaveFullscreen({ fullscreenElement: {}, exitFullscreen: () => Promise.reject(new Error("x")) })).resolves.toBeUndefined();
    await expect(leaveFullscreen(undefined)).resolves.toBeUndefined();
  });

  it("Wake Lock API がない・拒否される環境では null（例外を出さない）", async () => {
    expect(await requestWakeLock(undefined)).toBeNull();
    expect(await requestWakeLock({})).toBeNull();
    expect(await requestWakeLock({ wakeLock: { request: () => Promise.reject(new Error("NotAllowedError")) } })).toBeNull();
    const release = vi.fn(async () => undefined);
    const sentinel = await requestWakeLock({ wakeLock: { request: async () => ({ release, released: false }) } });
    expect(sentinel).not.toBeNull();
    await releaseWakeLock(sentinel);
    expect(release).toHaveBeenCalledTimes(1);
    await expect(releaseWakeLock({ release: () => Promise.reject(new Error("x")) })).resolves.toBeUndefined();
    await expect(releaseWakeLock(null)).resolves.toBeUndefined();
  });
});

describe("要確認の決済の件数", () => {
  it("金額不一致の決済は要確認として一覧に出る", async () => {
    const productId = await createProduct(IDS.storeA);
    const order = await createOrder(IDS.userA, productId, 1);
    await asService((q) =>
      q.query(
        "insert into public.payments (order_id, provider, provider_payment_id, amount, status, failure_reason) values ($1, 'stripe', 'pi_x', 1, 'requires_review', 'amount_mismatch')",
        [order.id],
      ),
    );
    const rows = await listRequiresReview();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orderNumber: order.orderNumber, storeName: "店舗A", amount: 1, failureReason: "amount_mismatch" });
  });
});
