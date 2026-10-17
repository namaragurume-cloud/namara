import { describe, expect, it } from "vitest";
import { BREAK_EVEN_GMV, calcMonthlyFee, calcMonthlyFeeFromCompletions, commissionFor } from "@/lib/fees";

describe("手数料計算", () => {
  it("FREE: 月額0円 + 成約売上 × 15%", () => {
    const fee = calcMonthlyFee("free", 100_000);
    expect(fee.monthlyFee).toBe(0);
    expect(fee.commission).toBe(15_000);
    expect(fee.total).toBe(15_000);
  });

  it("STANDARD: 月額4,980円 + 成約売上 × 5%", () => {
    const fee = calcMonthlyFee("standard", 100_000);
    expect(fee.monthlyFee).toBe(4_980);
    expect(fee.commission).toBe(5_000);
    expect(fee.total).toBe(9_980);
  });

  it("成約0件の月: FREE は0円、STANDARD は月額のみ", () => {
    expect(calcMonthlyFee("free", 0).total).toBe(0);
    expect(calcMonthlyFee("standard", 0).total).toBe(4_980);
  });

  it("円未満は切り捨て・浮動小数点の誤差が出ない", () => {
    expect(commissionFor(799, 1500)).toBe(119); // 119.85
    expect(commissionFor(1, 500)).toBe(0);
    expect(calcMonthlyFee("free", 33_333).commission).toBe(4_999); // 4999.95
    expect(calcMonthlyFee("standard", 0.1 + 0.2).commission).toBe(0);
  });

  it("月の途中でプランを変えた場合は成約時点の手数料率で合算する", () => {
    const fee = calcMonthlyFeeFromCompletions("standard", [
      { totalPrice: 1000, commissionRate: 0.15 },
      { totalPrice: 1000, commissionRate: "0.0500" },
      { totalPrice: 1000, commissionRate: null, planCode: "free" },
    ]);
    expect(fee.gmv).toBe(3000);
    expect(fee.commission).toBe(350);
    expect(fee.monthlyFee).toBe(4_980);
    expect(fee.total).toBe(5_330);
  });

  it("損益分岐は月間成約額 49,800円", () => {
    expect(BREAK_EVEN_GMV).toBe(49_800);
    expect(calcMonthlyFee("free", BREAK_EVEN_GMV).total).toBe(calcMonthlyFee("standard", BREAK_EVEN_GMV).total);
  });
});
