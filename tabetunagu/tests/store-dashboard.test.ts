import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { BREAK_EVEN_GMV, calcMonthlyFee } from "@/lib/fees";
import { sanitizeAiDescription } from "@/lib/ai-copy";
import { storeReadiness } from "@/lib/readiness";
import {
  duplicateDefaults,
  parseSalesPeriod,
  pickupPreview,
  planView,
  productStateLabel,
  readinessProgress,
  salesRange,
  standardHint,
  storeAlerts,
  storeNetEstimate,
} from "@/lib/store-dashboard";
import { productFormSchema } from "@/lib/validation";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { createOrder } from "@/server/services/orders";
import { requestUserRefund } from "@/server/services/payments";
import { createProduct as createProductAsStore } from "@/server/services/store";
import { getStoreOps } from "@/server/services/store-ops";
import { createProduct, createTestDb, getProduct, IDS, setOrderStatus, shiftOrderWindow } from "./support/db";
import { connectStore, createPaidOrder, installFakeStripe, uninstallFakeStripe, type FakeStripe } from "./support/stripe";

/** 店舗ダッシュボード・出品・売上（固定時刻で検証） */

describe("商品の状態（内部の status 名を出さない）", () => {
  const now = Date.parse("2026-10-23T19:00:00+09:00");
  const future = "2026-10-23T21:00:00+09:00";
  it.each([
    ["published", future, "公開中"],
    ["sold_out", future, "売り切れ"],
    ["draft", future, "下書き"],
    ["closed", future, "非公開"],
    ["published", "2026-10-23T18:00:00+09:00", "受付終了"],
  ])("%s（受取終了 %s）→ %s", (status, end, label) => {
    expect(productStateLabel(status, end, now)).toBe(label);
  });
});

describe("プラン・損益分岐・店舗受取見込", () => {
  it("FREE: 月額0円・手数料20%。STANDARD: 月額4,980円・手数料8%（lib/fees から）", () => {
    expect(planView("free")).toEqual({ code: "free", name: "FREE", monthlyFee: 0, commissionPercent: 20 });
    expect(planView("standard")).toEqual({ code: "standard", name: "STANDARD", monthlyFee: 4980, commissionPercent: 8 });
    expect(calcMonthlyFee("free", 50_000).total).toBe(10_000);
    expect(calcMonthlyFee("standard", 50_000).total).toBe(4_980 + 4_000);
  });
  it("店舗受取見込 = 売上 − 成約手数料（FREE で 50,000円なら 40,000円）", () => {
    expect(storeNetEstimate(50_000, calcMonthlyFee("free", 50_000).commission)).toBe(40_000);
    expect(storeNetEstimate(0, 0)).toBe(0);
  });
  it("損益分岐は約41,500円。未満は「あと○円」、超えたら手数料負担を抑えられる可能性。STANDARD 店舗・遠い売上には出さない", () => {
    expect(BREAK_EVEN_GMV).toBe(41_500);
    expect(standardHint("free", 39_800)).toEqual({ kind: "near", sales: 39_800, gap: 1_700, breakEven: BREAK_EVEN_GMV });
    expect(standardHint("free", 41_499)).toMatchObject({ kind: "near", gap: 1 });
    const over = standardHint("free", 41_500);
    expect(over).toMatchObject({ kind: "over", freeFee: 8_300, standardFee: 8_300 });
    expect(standardHint("free", 58_000)).toMatchObject({ kind: "over", freeFee: 11_600, standardFee: 4_980 + 4_640 });
    expect(standardHint("free", 20_000)).toBeNull();
    expect(standardHint("standard", 90_000)).toBeNull();
  });
});

describe("導入準備・お知らせ", () => {
  it("進捗: 「あと○項目で公開準備完了」", () => {
    const r = storeReadiness({ storeActive: true, hasStoreInfo: true, productCount: 1, publishedCount: 0, stripeReady: false, monitorOpened: true });
    expect(readinessProgress(r.items)).toEqual({ done: 3, total: 5, left: 2, text: "あと2項目で公開準備完了" });
    const all = storeReadiness({ storeActive: true, hasStoreInfo: true, productCount: 1, publishedCount: 1, stripeReady: true, monitorOpened: true });
    expect(readinessProgress(all.items).text).toBe("公開準備が完了しています");
  });
  it("Stripe 未設定: オーナーは売上受取設定へ、スタッフには設定の導線を出さない。商品0件・公開なし・受取予定・昨日の未受取", () => {
    const base = { stripeReady: false, upcomingPickups: 3, unclaimedYesterday: 1, productCount: 0, liveCount: 0 };
    const owner = storeAlerts({ ...base, isOwner: true });
    expect(owner.map((a) => a.key)).toEqual(["stripe", "no_products", "pickups", "unclaimed"]);
    expect(owner[0]).toMatchObject({ text: "売上受取設定を完了してください", href: "/store/payouts" });
    expect(owner.find((a) => a.key === "pickups")!.text).toBe("これから3件受取予定");
    expect(owner.find((a) => a.key === "unclaimed")!.text).toBe("昨日の未受取 1件");
    const staff = storeAlerts({ ...base, isOwner: false });
    expect(staff.some((a) => a.href === "/store/payouts")).toBe(false);
    expect(storeAlerts({ ...base, productCount: 2, isOwner: true }).find((a) => a.key === "no_live")!.text).toBe("公開中の商品がありません");
  });
});

describe("出品: 受取時間・複製・AI", () => {
  it("日付またぎ: 10/23 23:30〜10/24 01:30（終了が開始より小さくても日付込みで正しく扱う）", () => {
    const p = pickupPreview("2026-10-23", "23:30", "01:30")!;
    expect(p.label).toBe("10/23 23:30〜10/24 01:30");
    expect(p.overnight).toBe(true);
    expect(p.minutes).toBe(120);
    expect(p.end.toISOString()).toBe(new Date("2026-10-24T01:30:00+09:00").toISOString());
    expect(pickupPreview("2026-10-23", "20:30", "23:30")).toMatchObject({ label: "10/23 20:30〜23:30", overnight: false });
    expect(pickupPreview("2026-10-23", "", "23:30")).toBeNull();
  });
  it("複製: 商品名・画像・価格・参考価格・説明・BOX は引き継ぎ、数量・受取時間は空（必ず入力し直す）", () => {
    const d = duplicateDefaults({
      name: "パンBOX",
      description: "説明",
      category: "bread",
      isBox: true,
      originalPrice: 1500,
      rescuePrice: 750,
      imageUrl: "/demo/bread.webp",
    });
    expect(d).toMatchObject({ name: "パンBOX", description: "説明", isBox: true, originalPrice: 1500, rescuePrice: 750, imageUrl: "/demo/bread.webp" });
    expect(d).toMatchObject({ quantity: "", pickupStart: "", pickupEnd: "", templateId: "" });
  });
  it("AI の紹介文にアレルゲン・原材料・期限・安全性が入っていたら使わない（テンプレートに切り替える）", () => {
    expect(sanitizeAiDescription("本日限定のパンBOX。\n小麦・卵のアレルゲンを含みます。20時まで。")).toBeNull();
    expect(sanitizeAiDescription("本日限定のパンBOX。\n消費期限は本日中です。20時まで。")).toBeNull();
    expect(sanitizeAiDescription("本日限定のパンBOX。\n今日のパンを詰め合わせました。20時まで、残り3BOX。")).not.toBeNull();
  });
  it("売上の期間: 今日・7日・今月（既定は今月。JST）", () => {
    const now = new Date("2026-10-23T01:30:00+09:00");
    expect(parseSalesPeriod(undefined)).toBe("month");
    expect(salesRange("today", now).start).toEqual(new Date("2026-10-23T00:00:00+09:00"));
    expect(salesRange("7d", now).start).toEqual(new Date("2026-10-17T00:00:00+09:00"));
    expect(salesRange("month", now).start).toEqual(new Date("2026-10-01T00:00:00+09:00"));
  });
});

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

let driver: Driver | undefined;
let fake: FakeStripe;

describe("店舗の集計・出品（DB）", () => {
  beforeEach(async () => {
    await driver?.close();
    driver = await createTestDb();
    fake = installFakeStripe();
    await connectStore(IDS.storeA, "acct_storeA");
  });
  afterEach(() => uninstallFakeStripe());
  afterAll(async () => {
    await driver?.close();
  });

  it("売上: paid・picked_up・unclaimed を含み、refunded・pending_payment は含めない。受取見込 = 売上 − 手数料", async () => {
    await createPaidOrder(fake, IDS.userA, IDS.storeA, { price: 1000, startIn: 30, endIn: 90 }); // paid（これから受取）
    const missed = await createPaidOrder(fake, IDS.userB, IDS.storeA, { price: 500 });
    await shiftOrderWindow(missed.order.id, -120, -60);
    await setOrderStatus(missed.order.id, "unclaimed");
    const refunded = await createPaidOrder(fake, IDS.userB, IDS.storeA, { price: 700, startIn: 30, endIn: 90 });
    await requestUserRefund(IDS.userB, refunded.order.id);
    await createOrder(IDS.userA, await createProduct(IDS.storeA, { price: 900 }), 1); // お支払い待ち

    const ops = await getStoreOps(IDS.ownerA, IDS.storeA, "month");
    expect(ops.period.sales).toBe(1500);
    expect(ops.period.orders).toBe(2);
    expect(ops.period.commission).toBe(Math.floor(1000 * 0.2) + Math.floor(500 * 0.2));
    expect(ops.period.storeNet).toBe(1500 - ops.period.commission);
    expect(ops.period.unclaimed).toBe(1);
    expect(ops.period.refunded).toBe(1);
    expect(ops.period.refundedAmount).toBe(700);
    expect(ops.today.sales).toBe(1500);
    expect(ops.upcomingPickups).toBe(1);
    expect(ops.products.total).toBe(4);
  });

  it("商品0件・売上0（空状態の判定に使う値）", async () => {
    const ops = await getStoreOps(IDS.ownerA, IDS.storeA, "today");
    expect(ops.products).toEqual({ total: 0, live: 0 });
    expect(ops.period.sales).toBe(0);
    expect(ops.upcomingPickups).toBe(0);
  });

  it("他店舗のメンバー・一般ユーザーは集計を見られない（他店舗のデータは含めない）", async () => {
    await createPaidOrder(fake, IDS.userA, IDS.storeA, { price: 1000 });
    await expect(getStoreOps(IDS.staffB, IDS.storeA)).rejects.toBeInstanceOf(AppError);
    await expect(getStoreOps(IDS.userA, IDS.storeA)).rejects.toBeInstanceOf(AppError);
    expect((await getStoreOps(IDS.staffB, IDS.storeB)).period.sales).toBe(0);
  });

  it("日付またぎの商品を作成できる（10/23 23:30 〜 10/24 01:30 を実日時で保存）", async () => {
    const now = new Date("2030-01-10T22:00:00+09:00");
    const form = productFormSchema.parse({
      name: "深夜の食べつなぎBOX",
      category: "bento",
      isBox: "on",
      originalPrice: "1500",
      rescuePrice: "750",
      quantity: "3",
      pickupDate: "2030-01-10",
      pickupStart: "23:30",
      pickupEnd: "01:30",
    });
    const id = await createProductAsStore(IDS.ownerA, IDS.storeA, form, now);
    const [p] = await asService((q) =>
      q.query<{ s: string; e: string }>("select pickup_start_at as s, pickup_end_at as e from public.products where id = $1", [id]),
    );
    expect(new Date(p.s).toISOString()).toBe(new Date("2030-01-10T23:30:00+09:00").toISOString());
    expect(new Date(p.e).toISOString()).toBe(new Date("2030-01-11T01:30:00+09:00").toISOString());
    expect((await getProduct(id)).quantity).toBe(3);
  });
});
