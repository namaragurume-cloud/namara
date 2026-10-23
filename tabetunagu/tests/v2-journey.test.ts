import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { features } from "@/lib/features";
import { chargeNote, v2ProductCta } from "@/lib/purchase";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { getProductDetail } from "@/server/services/catalog";
import { createOrder } from "@/server/services/orders";
import { pickupOrder } from "@/server/services/pickup";
import { requestUserRefund } from "@/server/services/payments";
import { getStoreOrderSales, getV2Kpis } from "@/server/services/v2-metrics";
import { createProduct, createTestDb, IDS, setOrderStatus, shiftOrderWindow } from "./support/db";
import { connectStore, createPaidOrder, installFakeStripe, uninstallFakeStripe, type FakeStripe } from "./support/stripe";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));
vi.mock("@/server/auth/viewer", () => ({
  getViewer: async () => (session.userId ? { id: session.userId, memberships: [] } : null),
  assertStoreMember: async () => {
    throw new Error("not used");
  },
}));
const { purchaseAction } = await import("@/app/actions/payments");

const ENV_KEYS = ["ENABLE_V2_CHECKOUT", "APP_ENV", "VERCEL_ENV"] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const k of ENV_KEYS) {
    const v = k in values ? values[k] : savedEnv[k];
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
});

afterEach(() => {
  uninstallFakeStripe();
  setEnv({});
});

afterAll(async () => {
  await driver?.close();
});

const form = (data: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
};

describe("機能フラグ", () => {
  it("ENABLE_V2_CHECKOUT=true のときだけ v2 がメインの導線（未設定・false は OFF）", () => {
    setEnv({ ENABLE_V2_CHECKOUT: undefined });
    expect(features.v2Journey).toBe(false);
    setEnv({ ENABLE_V2_CHECKOUT: "false" });
    expect(features.v2Journey).toBe(false);
    setEnv({ ENABLE_V2_CHECKOUT: "1" });
    expect(features.v2Journey).toBe(false);
    setEnv({ ENABLE_V2_CHECKOUT: "true" });
    expect(features.v2Journey).toBe(true);
  });

  it("production では明示的に ON にしない限り v2 の購入を受け付けない（開発・プレビューでは URL で確認できる）", () => {
    setEnv({ ENABLE_V2_CHECKOUT: undefined, APP_ENV: "production" });
    expect(features.v2CheckoutOpen).toBe(false);
    setEnv({ ENABLE_V2_CHECKOUT: "true", APP_ENV: "production" });
    expect(features.v2CheckoutOpen).toBe(true);
    setEnv({ ENABLE_V2_CHECKOUT: undefined, APP_ENV: "preview" });
    expect(features.v2CheckoutOpen).toBe(true);
    setEnv({ ENABLE_V2_CHECKOUT: undefined, APP_ENV: undefined, VERCEL_ENV: "production" });
    expect(features.v2CheckoutOpen).toBe(false);
  });

  it("フラグ OFF の production では購入（Checkout 開始）を受け付けず、在庫も押さえない", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 2 });
    session.userId = IDS.userA;
    setEnv({ ENABLE_V2_CHECKOUT: undefined, APP_ENV: "production" });
    expect(await purchaseAction(null, form({ productId, quantity: "1" }))).toMatchObject({ ok: false, code: "v2_checkout_closed" });
    expect(fake.sessions).toHaveLength(0);

    setEnv({ ENABLE_V2_CHECKOUT: "true", APP_ENV: "production" });
    await expect(purchaseAction(null, form({ productId, quantity: "1" }))).rejects.toMatchObject({ url: expect.stringContaining("checkout.stripe.com") });
    expect(fake.sessions).toHaveLength(1);
  });
});

describe("商品詳細の CTA（v2）", () => {
  const base = {
    productId: "p1",
    status: "published",
    remaining: 3,
    pickupEndAt: new Date(Date.now() + 3_600_000).toISOString(),
    storeActive: true,
    storePayable: true,
    myOrderId: null,
    now: Date.now(),
  };

  it("在庫あり → 購入確認へ", () => {
    expect(v2ProductCta(base)).toEqual({ kind: "buy", label: "食べつなぐ", href: "/products/p1/buy" });
  });
  it("売り切れ・受付終了・決済準備中・注文済み", () => {
    expect(v2ProductCta({ ...base, status: "sold_out", remaining: 0 })).toMatchObject({ kind: "sold_out", label: "売り切れ" });
    expect(v2ProductCta({ ...base, remaining: 0 })).toMatchObject({ kind: "sold_out" });
    expect(v2ProductCta({ ...base, pickupEndAt: new Date(base.now - 1000).toISOString() })).toMatchObject({ kind: "ended", label: "受付終了" });
    expect(v2ProductCta({ ...base, status: "closed" })).toMatchObject({ kind: "ended" });
    expect(v2ProductCta({ ...base, storeActive: false })).toMatchObject({ kind: "ended" });
    expect(v2ProductCta({ ...base, storePayable: false })).toMatchObject({ kind: "not_ready", label: "購入準備中" });
    expect(v2ProductCta({ ...base, storePayable: false, myOrderId: "o1" })).toEqual({ kind: "order", label: "注文を確認する", href: "/orders/o1" });
  });
  it("つなぐチャージ 30円・30pt の説明（断定的な表現はしない）", () => {
    expect(chargeNote.short).toBe("購入時に30円のつなぐチャージが加算されます。");
    expect(chargeNote.points).toBe("つなぐチャージ30円につき、30ptを付与します。");
    expect(`${chargeNote.short}${chargeNote.points}`).not.toMatch(/実質無料|必ず|得する/);
  });

  it("商品詳細のデータ: 店舗の決済可否と、自分の有効な注文", async () => {
    const productA = await createProduct(IDS.storeA);
    const productB = await createProduct(IDS.storeB);
    expect((await getProductDetail(IDS.userA, productA))!.storePayable).toBe(true);
    expect((await getProductDetail(null, productB))!.storePayable).toBe(false); // 店舗B は Connect 未完了
    const order = await createOrder(IDS.userA, productA, 1);
    expect((await getProductDetail(IDS.userA, productA))!.myOrderId).toBe(order.id);
    expect((await getProductDetail(IDS.userB, productA))!.myOrderId).toBeNull();
    await setOrderStatus(order.id, "cancelled");
    expect((await getProductDetail(IDS.userA, productA))!.myOrderId).toBeNull();
  });
});

describe("店舗売上（v2）", () => {
  it("決済済み（受取待ち・受取完了・未受取）を売上に計上し、返金済み・決済待ちは含めない", async () => {
    await createPaidOrder(fake, IDS.userA, IDS.storeA, { price: 1000, startIn: 30, endIn: 90 });
    const picked = await createPaidOrder(fake, IDS.userA, IDS.storeA, { price: 800, startIn: -5, endIn: 60 });
    await pickupOrder(IDS.userA, picked.order.id);
    const missed = await createPaidOrder(fake, IDS.userB, IDS.storeA, { price: 500 });
    await shiftOrderWindow(missed.order.id, -120, -60);
    await setOrderStatus(missed.order.id, "unclaimed");
    const refunded = await createPaidOrder(fake, IDS.userB, IDS.storeA, { price: 700, startIn: 30, endIn: 90 });
    await requestUserRefund(IDS.userB, refunded.order.id);
    await createOrder(IDS.ownerA, await createProduct(IDS.storeA, { price: 900 }), 1); // 決済待ち

    const s = await getStoreOrderSales(IDS.staffA, IDS.storeA);
    // 店舗A は FREE（20%）: 1000 + 800 + 500 = 2300、手数料 200 + 160 + 100 = 460
    expect(s.month).toEqual({
      sales: 2300,
      orders: 3,
      commission: 460,
      storeNet: 1840,
      pickedUp: 1,
      unclaimed: 1,
      awaitingPickup: 1,
      refunded: 1,
      refundedAmount: 700,
    });
    expect(s.today).toEqual({ sales: 2300, orders: 3 });
  });

  it("他店舗の売上は見られない", async () => {
    await expect(getStoreOrderSales(IDS.staffB, IDS.storeA)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("管理 KPI（v2）", () => {
  it("GMV・決済済み・受取完了・未受取・返金・プラットフォーム売上・発行ポイント・自己スワイプ完了率", async () => {
    const picked = await createPaidOrder(fake, IDS.userA, IDS.storeA, { price: 1000, startIn: -5, endIn: 60 });
    await pickupOrder(IDS.userA, picked.order.id);
    await shiftOrderWindow(picked.order.id, -120, -60); // 受取期限が来た受取完了
    const missed = await createPaidOrder(fake, IDS.userB, IDS.storeA, { price: 500 });
    await shiftOrderWindow(missed.order.id, -120, -60);
    await setOrderStatus(missed.order.id, "unclaimed");
    const refunded = await createPaidOrder(fake, IDS.userB, IDS.storeA, { price: 700, startIn: 30, endIn: 90 });
    await requestUserRefund(IDS.userB, refunded.order.id);
    await createOrder(IDS.ownerA, await createProduct(IDS.storeA), 1); // 決済待ち（含めない）

    const from = new Date(Date.now() - 86_400_000);
    const to = new Date(Date.now() + 86_400_000);
    const k = await getV2Kpis(from, to, 15);
    expect(k.gmv).toBe(1500);
    expect(k.charged).toBe(1560);
    expect(k.paidOrders).toBe(2);
    expect(k.pickedUp).toBe(1);
    expect(k.unclaimed).toBe(1);
    expect(k.refunded).toBe(1);
    expect(k.commission).toBe(300);
    expect(k.tsunaguCharge).toBe(60);
    expect(k.platformRevenue).toBe(360);
    expect(k.points).toEqual({ issued: 90, revoked: 30, outstanding: 60 });
    expect(k.poc.swipeRate).toBe(0.5); // 受取期限が来た2件のうち受取完了1件
    expect(k.requiresReview).toBe(0);
  });

  it("定期処理の遅れ（期限を30分以上過ぎて未処理の注文）を検知する", async () => {
    const stale = await createOrder(IDS.userA, await createProduct(IDS.storeA), 1);
    await asService((q) =>
      q.query("update public.orders set payment_expires_at = now() - interval '45 minutes' where id = $1", [stale.id]),
    );
    const k = await getV2Kpis(new Date(Date.now() - 86_400_000), new Date(Date.now() + 86_400_000), 15);
    expect(k.maintenanceBacklog).toBe(1);
  });
});
