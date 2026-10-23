import { describe, expect, it } from "vitest";
import {
  BREAK_EVEN_GMV,
  calcMonthlyFee,
  calcMonthlyFeeFromCompletions,
  calcOrderAmounts,
  commissionFor,
  estimatePaymentFee,
  PRICING,
} from "@/lib/fees";

describe("手数料計算", () => {
  it("FREE: 月額0円 + 成約売上 × 20%", () => {
    const fee = calcMonthlyFee("free", 100_000);
    expect(fee.monthlyFee).toBe(0);
    expect(fee.commission).toBe(20_000);
    expect(fee.total).toBe(20_000);
  });

  it("STANDARD: 月額4,980円 + 成約売上 × 8%", () => {
    const fee = calcMonthlyFee("standard", 100_000);
    expect(fee.monthlyFee).toBe(4_980);
    expect(fee.commission).toBe(8_000);
    expect(fee.total).toBe(12_980);
  });

  it("成約0件の月: FREE は0円、STANDARD は月額のみ", () => {
    expect(calcMonthlyFee("free", 0).total).toBe(0);
    expect(calcMonthlyFee("standard", 0).total).toBe(4_980);
  });

  it("円未満は切り捨て・浮動小数点の誤差が出ない", () => {
    expect(commissionFor(799, 2000)).toBe(159); // 159.8
    expect(commissionFor(1, 800)).toBe(0);
    expect(calcMonthlyFee("free", 33_333).commission).toBe(6_666); // 6666.6
    expect(calcMonthlyFee("standard", 0.1 + 0.2).commission).toBe(0);
  });

  it("月の途中でプランを変えた場合は成約時点の手数料率で合算する（過去の率はそのまま）", () => {
    const fee = calcMonthlyFeeFromCompletions("standard", [
      { totalPrice: 1000, commissionRate: 0.15 }, // 旧 FREE の率で成約した過去分
      { totalPrice: 1000, commissionRate: "0.0800" },
      { totalPrice: 1000, commissionRate: null, planCode: "free" },
    ]);
    expect(fee.gmv).toBe(3000);
    expect(fee.commission).toBe(430); // 150 + 80 + 200
    expect(fee.monthlyFee).toBe(4_980);
    expect(fee.total).toBe(5_410);
  });

  it("損益分岐は月間成約額 41,500円", () => {
    expect(BREAK_EVEN_GMV).toBe(41_500);
    expect(calcMonthlyFee("free", BREAK_EVEN_GMV).total).toBe(calcMonthlyFee("standard", BREAK_EVEN_GMV).total);
    // 損益分岐を超えると STANDARD のほうが安い
    expect(calcMonthlyFee("standard", 50_000).total).toBeLessThan(calcMonthlyFee("free", 50_000).total);
    expect(calcMonthlyFee("standard", 30_000).total).toBeGreaterThan(calcMonthlyFee("free", 30_000).total);
  });
});

describe("注文の金額内訳", () => {
  it("料金・ポイント・決済原価の想定値は一元管理された値", () => {
    expect(PRICING.plans.free.commissionBps).toBe(2000);
    expect(PRICING.plans.standard.commissionBps).toBe(800);
    expect(PRICING.plans.standard.monthlyFee).toBe(4980);
    expect(PRICING.tsunaguCharge).toBe(30);
    expect(PRICING.orderPoints).toBe(30);
    expect(PRICING.paymentFeeAssumption.percentBps).toBeGreaterThan(0);
  });

  it("FREE: 小計1,000円 → 手数料200円 + つなぐチャージ30円 = プラットフォーム売上230円", () => {
    const a = calcOrderAmounts([{ unitPrice: 1000, quantity: 1 }], PRICING.plans.free.commissionBps);
    expect(a).toEqual({
      subtotal: 1000,
      tsunaguCharge: 30,
      total: 1030,
      commissionBps: 2000,
      commissionAmount: 200,
      platformFeeTotal: 230,
      storeNet: 800,
    });
  });

  it("STANDARD: つなぐチャージは成約手数料の計算対象に含めない", () => {
    const a = calcOrderAmounts([{ unitPrice: 800, quantity: 2 }], PRICING.plans.standard.commissionBps);
    expect(a.subtotal).toBe(1600);
    expect(a.commissionAmount).toBe(128); // 1600 × 8%（1630 × 8% = 130 ではない）
    expect(a.total).toBe(1630);
    expect(a.platformFeeTotal).toBe(158);
    expect(a.storeNet).toBe(1472);
  });

  it("決済原価の見込みは設定値から計算する（想定値を差し替えられる）", () => {
    expect(estimatePaymentFee(1030, { provider: "stripe", percentBps: 360, fixedYen: 0 })).toBe(38); // 37.08 → 切り上げ
    expect(estimatePaymentFee(1000, { provider: "stripe", percentBps: 250, fixedYen: 10 })).toBe(35);
    expect(estimatePaymentFee(0)).toBe(0);
  });
});
