import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PRICING } from "@/lib/fees";
import { ORDER_POLICY } from "@/lib/orders";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { createTestDb } from "./support/db";

/** アプリの料金・運用定数と DB（plans / platform_settings）の値が一致していること */
let driver: Driver | undefined;

beforeAll(async () => {
  driver = await createTestDb();
});

afterAll(async () => {
  await driver?.close();
});

describe("料金設定の一元管理（アプリと DB の一致）", () => {
  it("plans の月額・手数料率が src/lib/fees.ts と一致する", async () => {
    const rows = await asService((q) =>
      q.query<{ code: "free" | "standard"; monthly_fee: number; commission_bps: number }>(
        "select code, monthly_fee, commission_bps from public.plans order by code",
      ),
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.monthly_fee).toBe(PRICING.plans[r.code].monthlyFee);
      expect(r.commission_bps).toBe(PRICING.plans[r.code].commissionBps);
    }
  });

  it("platform_settings が src/lib/fees.ts / src/lib/orders.ts と一致する", async () => {
    const rows = await asService((q) =>
      q.query<{ key: string; int_value: number }>("select key, int_value from public.platform_settings"),
    );
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.int_value]));
    expect(settings).toEqual({
      tsunagu_charge_yen: PRICING.tsunaguCharge,
      order_points: PRICING.orderPoints,
      payment_hold_minutes: ORDER_POLICY.paymentHoldMinutes,
      user_refund_window_minutes: ORDER_POLICY.userRefundWindowMinutes,
      max_pending_orders_per_user: ORDER_POLICY.maxPendingOrdersPerUser,
      pickup_early_grace_minutes: ORDER_POLICY.pickupEarlyGraceMinutes,
      pickup_late_grace_minutes: ORDER_POLICY.pickupLateGraceMinutes,
    });
  });
});
