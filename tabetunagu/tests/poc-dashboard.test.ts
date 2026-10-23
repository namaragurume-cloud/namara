import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BREAK_EVEN_GMV, calcMonthlyFee } from "@/lib/fees";
import {
  buildAlerts,
  cronHealth,
  CRON_NOTICE_MINUTES,
  dashboardRange,
  flagView,
  goNoGoSummary,
  isHighUnclaimed,
  kpiState,
  parseDashboardPeriod,
  POC_TARGETS,
  pocKpis,
  pocStatus,
  standardCandidates,
  unclaimedRate,
  type AlertInput,
} from "@/lib/poc-dashboard";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { CRON_STALE_MINUTES } from "@/server/services/ops";
import { createOrder } from "@/server/services/orders";
import { requestUserRefund } from "@/server/services/payments";
import { pickupOrder } from "@/server/services/pickup";
import { getPocDashboard } from "@/server/services/poc-dashboard";
import { createProduct, createTestDb, IDS, setOrderStatus, shiftOrderWindow } from "./support/db";
import { connectStore, createPaidOrder, installFakeStripe, uninstallFakeStripe, type FakeStripe } from "./support/stripe";

const session = vi.hoisted(() => ({ userId: null as string | null, admin: false }));
vi.mock("@/server/auth/viewer", () => ({
  getViewer: async () => (session.userId ? { id: session.userId, isAdmin: session.admin, memberships: [] } : null),
}));
const { GET: exportGET } = await import("@/app/admin/export/route");

/** 管理ダッシュボード（PoC 運営の判断用）。表示ルールは固定値・固定時刻で検証する */

describe("KPI の評価（達成・あと少し・未達・データ不足）", () => {
  it("目標以上は達成、目標の90%以上はあと少し、それ未満は未達", () => {
    expect(kpiState(0.82, 0.8, 50, 20)).toBe("achieved");
    expect(kpiState(0.8, 0.8, 50, 20)).toBe("achieved");
    expect(kpiState(0.75, 0.8, 50, 20)).toBe("near");
    expect(kpiState(0.71, 0.8, 50, 20)).toBe("missed");
  });
  it("母数が少ないときは成功・失敗を判定しない（データ不足）", () => {
    expect(kpiState(1, 0.4, 8, 20)).toBe("insufficient");
    expect(kpiState(null, 0.4, 0, 20)).toBe("insufficient");
    expect(kpiState(0.5, 0.4, 20, 20)).toBe("achieved");
  });
  it("目標値は1か所（POC_TARGETS）。食べつなぎ80%・リピート40%・店舗WAU70%・スワイプ95%・STANDARD候補6店舗", () => {
    expect(POC_TARGETS.tsunagiRate.target).toBe(0.8);
    expect(POC_TARGETS.repeatRate.target).toBe(0.4);
    expect(POC_TARGETS.storeWau.target).toBe(0.7);
    expect(POC_TARGETS.swipeRate.target).toBe(0.95);
    expect(POC_TARGETS.standardCandidates.target).toBe(6);
  });
  it("5つの KPI を母数つきで返す", () => {
    const k = pocKpis({
      tsunagi: { sold: 41, listed: 50 },
      repeat: { repeated: 3, cohort: 8 },
      storeWau: { active7d: 7, activeStores: 10 },
      swipe: { done: 48, due: 50 },
      standardCandidates: 2,
    });
    expect(k.map((x) => [x.key, x.state])).toEqual([
      ["tsunagiRate", "achieved"],
      ["repeatRate", "insufficient"], // 対象8人 → データ不足
      ["storeWau", "achieved"],
      ["swipeRate", "achieved"],
      ["standardCandidates", "missed"],
    ]);
    expect(k[0]).toMatchObject({ value: 0.82, numerator: 41, denominator: 50 });
    expect(k[3]).toMatchObject({ value: 0.96, numerator: 48, denominator: 50 });
  });
});

describe("未受取率", () => {
  it("未受取 ÷（受取完了 + 未受取）。どちらも0なら null", () => {
    expect(unclaimedRate(8, 2)).toBe(0.2);
    expect(unclaimedRate(0, 0)).toBeNull();
  });
  it("受取結果が少ない店舗は「高い」と判定しない", () => {
    expect(isHighUnclaimed(2, 2)).toBe(false); // 4件
    expect(isHighUnclaimed(4, 1)).toBe(true); // 5件・20%
    expect(isHighUnclaimed(9, 1)).toBe(false); // 10%
  });
});

describe("STANDARD 候補（損益分岐は lib/fees から）", () => {
  it("損益分岐は 41,500円（FREE 20% と STANDARD 4,980円 + 8% が等しくなる売上）", () => {
    expect(BREAK_EVEN_GMV).toBe(41_500);
    expect(calcMonthlyFee("free", BREAK_EVEN_GMV).total).toBe(calcMonthlyFee("standard", BREAK_EVEN_GMV).total);
  });
  it("境界: 41,500円は超え、41,499円は「あと1円」。FREE 以外・損益分岐の70%未満は出さない", () => {
    const list = standardCandidates([
      { id: "a", name: "A", plan: "free", sales: 41_500 },
      { id: "b", name: "B", plan: "free", sales: 41_499 },
      { id: "c", name: "C", plan: "standard", sales: 90_000 },
      { id: "d", name: "D", plan: "free", sales: 20_000 },
    ]);
    expect(list.map((s) => [s.id, s.over, s.gap])).toEqual([
      ["a", true, 0],
      ["b", false, 1],
    ]);
  });
  it("並び順: 損益分岐を超えた店舗（売上の高い順）→ 近い店舗（残りの少ない順）。最大10店舗", () => {
    const stores = [
      { id: "near-far", name: "x", plan: "free", sales: 30_000 },
      { id: "over-low", name: "x", plan: "free", sales: 45_000 },
      { id: "near-close", name: "x", plan: "free", sales: 39_800 },
      { id: "over-high", name: "x", plan: "free", sales: 58_000 },
      ...Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, name: "x", plan: "free", sales: 31_000 + i })),
    ];
    const list = standardCandidates(stores);
    expect(list.slice(0, 3).map((s) => s.id)).toEqual(["over-high", "over-low", "near-close"]);
    expect(list).toHaveLength(10);
    expect(list.find((s) => s.id === "near-close")!.gap).toBe(1_700);
  });
});

describe("Cron・機能フラグ・要対応・PoC ステータス", () => {
  it("Cron: 10分未満は正常、10分以上は注意、15分以上・未実行は対応必要", () => {
    expect(cronHealth({ state: "ok", minutesAgo: 4 }, CRON_STALE_MINUTES)).toEqual({ severity: "ok", text: "最終成功 4分前" });
    expect(cronHealth({ state: "ok", minutesAgo: 12 }, CRON_STALE_MINUTES).severity).toBe("warning");
    expect(CRON_NOTICE_MINUTES).toBeLessThan(CRON_STALE_MINUTES);
    expect(cronHealth({ state: "stale", minutesAgo: 15 }, CRON_STALE_MINUTES).text).toContain("15分以上更新されていません");
    expect(cronHealth({ state: "never", minutesAgo: null }, CRON_STALE_MINUTES).severity).toBe("critical");
  });

  it("機能フラグ: OFF / ON / ON 指定だが設定不足で OFF（理由は設定名だけ。値は出さない）", () => {
    expect(flagView({ requested: false, effective: false, enforced: false, missing: [] })).toMatchObject({ state: "off", label: "OFF（旧導線）" });
    expect(flagView({ requested: true, effective: true, enforced: true, missing: [] }).label).toBe("ON（本番で有効）");
    const forced = flagView({ requested: true, effective: false, enforced: true, missing: ["STRIPE_WEBHOOK_SECRET"] });
    expect(forced).toEqual({ state: "forced_off", label: "ON 指定・設定不足のため OFF", reasons: ["Stripe Webhook Secret が未設定"] });
  });

  const base: AlertInput = {
    requiresReview: 0,
    refundsFailed: 0,
    cron: { severity: "ok", text: "最終成功 3分前" },
    maintenanceBacklog: 0,
    storesConnectPending: 0,
    highUnclaimedStores: 0,
    flag: flagView({ requested: false, effective: false, enforced: false, missing: [] }),
  };

  it("要対応: 問題があるものだけ、対応必要 → 注意 の順。0件なら空", () => {
    expect(buildAlerts(base)).toEqual([]);
    const alerts = buildAlerts({ ...base, requiresReview: 2, refundsFailed: 1, storesConnectPending: 4, highUnclaimedStores: 2 });
    expect(alerts.map((a) => [a.key, a.severity, a.count])).toEqual([
      ["requires_review", "critical", 2],
      ["refund_failed", "critical", 1],
      ["connect", "warning", 4],
      ["unclaimed", "warning", 2],
    ]);
    expect(alerts[0].href).toBe("/admin/review");
    expect(alerts.find((a) => a.key === "unclaimed")!.href).toBe("/admin/unclaimed");
    const forced = buildAlerts({ ...base, flag: flagView({ requested: true, effective: false, enforced: true, missing: ["CRON_SECRET"] }) });
    expect(forced[0]).toMatchObject({ key: "flag", severity: "critical", note: "CRON_SECRET が未設定（16文字以上）" });
  });

  it("PoC ステータス: 対応必要があれば要対応、v2 有効なら運用中、それ以外は公開準備中。「Go」とは表示しない", () => {
    const on = flagView({ requested: true, effective: true, enforced: true, missing: [] });
    expect(pocStatus([], on).label).toBe("運用中");
    expect(pocStatus([], base.flag).label).toBe("公開準備中");
    expect(pocStatus(buildAlerts({ ...base, requiresReview: 1 }), on).label).toBe("要対応");
    expect(pocStatus(buildAlerts({ ...base, storesConnectPending: 3 }), on).label).toBe("運用中"); // 注意だけなら要対応にしない
    const kpis = pocKpis({
      tsunagi: { sold: 90, listed: 100 },
      repeat: { repeated: 50, cohort: 100 },
      storeWau: { active7d: 9, activeStores: 10 },
      swipe: { done: 99, due: 100 },
      standardCandidates: 7,
    });
    const g = goNoGoSummary(kpis, []);
    expect(g).toMatchObject({ achieved: 5, total: 5, actionRequired: 0 });
    expect(g.verdict).not.toMatch(/^Go/);
    expect(g.verdict).toContain("公開準備未完了");
  });

  it("期間: 今日・7日・30日・PoC累計（既定は30日。JST の日付で区切る）", () => {
    const now = new Date("2026-10-23T01:30:00+09:00");
    expect(parseDashboardPeriod(undefined)).toBe("30d");
    expect(parseDashboardPeriod("x")).toBe("30d");
    expect(dashboardRange("today", now)).toMatchObject({
      from: new Date("2026-10-23T00:00:00+09:00"),
      to: new Date("2026-10-24T00:00:00+09:00"),
    });
    expect(dashboardRange("7d", now).from).toEqual(new Date("2026-10-17T00:00:00+09:00"));
    expect(dashboardRange("30d", now).from).toEqual(new Date("2026-09-24T00:00:00+09:00"));
    expect(dashboardRange("all", now).from.getUTCFullYear()).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// 集計（DB）
// ---------------------------------------------------------------------------

let driver: Driver | undefined;
let fake: FakeStripe;

describe("管理ダッシュボードの集計", () => {
  beforeEach(async () => {
    await driver?.close();
    driver = await createTestDb();
    fake = installFakeStripe();
    await connectStore(IDS.storeA, "acct_storeA");
    session.userId = null;
    session.admin = false;
  });
  afterEach(() => uninstallFakeStripe());
  afterAll(async () => {
    await driver?.close();
  });

  it("GMV・注文・実売上（手数料 + チャージ）。返金・決済待ちは含めず、未受取は売上に含める", async () => {
    const picked = await createPaidOrder(fake, IDS.userA, IDS.storeA, { price: 1000, startIn: -5, endIn: 60 });
    await pickupOrder(IDS.userA, picked.order.id);
    const missed = await createPaidOrder(fake, IDS.userB, IDS.storeA, { price: 500 });
    await shiftOrderWindow(missed.order.id, -120, -60);
    await setOrderStatus(missed.order.id, "unclaimed");
    const refunded = await createPaidOrder(fake, IDS.userB, IDS.storeA, { price: 700, startIn: 30, endIn: 90 });
    await requestUserRefund(IDS.userB, refunded.order.id);
    await createOrder(IDS.ownerA, await createProduct(IDS.storeA), 1); // 決済待ち

    const d = await getPocDashboard("30d");
    expect(d.sales.gmv).toBe(1500); // 1000 + 500（未受取を含む・返金を除く）
    expect(d.sales.orders).toBe(2);
    expect(d.sales.commission).toBe(300);
    expect(d.sales.tsunaguCharge).toBe(60);
    expect(d.sales.platformRevenue).toBe(360); // STANDARD の月額（未課金）は含めない
    expect(d.sales.refunds).toEqual({ count: 1, amount: 730 });
    expect(d.sales.unclaimed).toMatchObject({ count: 1, amount: 500, rate: 0.5, pickedUp: 1 });
    expect(d.points).toEqual({ issued: 90, revoked: 30, outstanding: 60 });
    expect(d.users).toEqual({ buyers: 2, firstTime: 2, repeatBuyers: 0 }); // 返金した注文は購入回数に数えない
    // 日別（0件の日も並ぶ。30日なら30日分）
    expect(d.trend).toHaveLength(30);
    expect(d.trend.reduce((s, t) => s + t.gmv, 0)).toBe(1500);
    expect(d.trend.every((t) => /^\d{2}\/\d{2}$/.test(t.day))).toBe(true);
    // 個人情報（ユーザー ID・Stripe の ID）を含めない
    const json = JSON.stringify(d);
    expect(json).not.toContain(IDS.userA);
    expect(json).not.toMatch(/pi_test_|acct_|cs_test_|re_test_/);
  });

  it("要確認の決済・失敗した返金は要対応（対応必要）になり、PoC ステータスは要対応", async () => {
    const { order } = await createPaidOrder(fake, IDS.userA, IDS.storeA);
    await asService((q) => q.query("update public.payments set status = 'requires_review' where order_id = $1", [order.id]));
    const d = await getPocDashboard("30d");
    expect(d.risk.requiresReview).toBe(1);
    expect(d.alerts.find((a) => a.key === "requires_review")).toMatchObject({ severity: "critical", count: 1 });
    expect(d.status.label).toBe("要対応");
  });

  it("STANDARD 候補: 直近30日の FREE 店舗の売上で判定（店舗ごとに問い合わせない）", async () => {
    await asService((q) => q.query("update public.stores set plan_code = 'free' where id = $1", [IDS.storeA]));
    // 直近30日の売上を損益分岐ちょうど（41,500円）にする（テスト専用: 注文のガードを外して小計を設定）
    const { order } = await createPaidOrder(fake, IDS.userA, IDS.storeA);
    await asService(async (q) => {
      await q.query("alter table public.orders disable trigger orders_guard");
      await q.query(
        `update public.orders set subtotal = $2, total = $2 + tsunagu_charge, commission_amount = floor($2 * commission_bps / 10000),
           platform_fee_total = floor($2 * commission_bps / 10000) + tsunagu_charge
         where id = $1`,
        [order.id, BREAK_EVEN_GMV],
      );
      await q.query("alter table public.orders enable trigger orders_guard");
    });
    const d = await getPocDashboard("30d");
    expect(d.standard.breakEven).toBe(BREAK_EVEN_GMV);
    const c = d.standard.candidates.find((s) => s.id === IDS.storeA)!;
    expect(c).toMatchObject({ sales: 41_500, over: true, gap: 0 });
    expect(d.standard.overBreakEven).toBe(1);
    expect(d.kpis.find((k) => k.key === "standardCandidates")!.value).toBe(1);
  });

  it("店舗: readiness の件数・Stripe 準備完了・店舗ヘルス（Stripe 未設定）", async () => {
    const d = await getPocDashboard("30d");
    const total = Object.values(d.stores.readiness).reduce((a, b) => a + b, 0);
    expect(total).toBe(d.stores.total);
    expect(d.stores.stripeReady).toBeGreaterThanOrEqual(1); // storeA は接続済み
    const b = d.stores.health.find((s) => s.id === IDS.storeB);
    expect(b?.issues).toContain("stripe_pending");
    expect(d.stores.health.find((s) => s.id === IDS.storeA)?.issues ?? []).not.toContain("stripe_pending");
  });

  it("CSV は管理者だけ（一般ユーザー・店舗スタッフ・未ログインは 404）。期間「今日」「7日」も出力できる", async () => {
    const get = (period: string) => exportGET(new Request(`http://localhost/admin/export?type=orders&period=${period}`));
    expect((await get("7d")).status).toBe(404);
    session.userId = IDS.staffA;
    expect((await get("7d")).status).toBe(404);
    session.userId = IDS.userA;
    expect((await get("today")).status).toBe(404);
    session.userId = IDS.admin;
    session.admin = true;
    const res = await get("today");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("tabetunagu-orders-today.csv");
    expect(await res.text()).not.toContain(IDS.userA);
  });
});
