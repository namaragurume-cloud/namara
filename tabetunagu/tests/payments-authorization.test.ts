import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { asAnon, asUser } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { requestUserRefund } from "@/server/services/payments";
import { createTestDb, IDS } from "./support/db";
import { connectStore, createPaidOrder, installFakeStripe, uninstallFakeStripe, type FakeStripe } from "./support/stripe";

let driver: Driver | undefined;
let fake: FakeStripe;

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

describe("RLS / 権限: 決済・返金", () => {
  it("返金の記録は本人と注文先の店舗メンバーだけが閲覧でき、誰も直接書き込めない", async () => {
    const { order } = await createPaidOrder(fake, IDS.userA, IDS.storeA, { startIn: 30 });
    await requestUserRefund(IDS.userA, order.id);

    expect(await asUser(IDS.userA, (q) => q.query("select * from public.refunds"))).toHaveLength(1);
    expect(await asUser(IDS.staffA, (q) => q.query("select * from public.refunds"))).toHaveLength(1);
    expect(await asUser(IDS.userB, (q) => q.query("select * from public.refunds"))).toHaveLength(0);
    expect(await asUser(IDS.staffB, (q) => q.query("select * from public.refunds"))).toHaveLength(0);
    await expect(asAnon((q) => q.query("select * from public.refunds"))).rejects.toThrow(/permission denied/);

    for (const user of [IDS.userA, IDS.staffA, IDS.ownerA]) {
      await expect(
        asUser(user, (q) => q.query("update public.refunds set status = 'failed' where order_id = $1", [order.id])),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(user, (q) =>
          q.query(
            "insert into public.refunds (order_id, payment_id, amount, reason, actor, scope) select order_id, payment_id, 1, 'x', 'user', 'order' from public.refunds",
          ),
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("決済状態を変える DB 関数は一般ユーザー・店舗から実行できない（service のみ）", async () => {
    const { order, paymentId } = await createPaidOrder(fake, IDS.userA, IDS.storeA, { startIn: 30 });
    const calls: [string, unknown[]][] = [
      ["select public.mark_order_paid($1::uuid, 'pi_x', 1, 'jpy', 'acct_storeA', 1, $2::uuid, $3::uuid)", [paymentId, order.id, IDS.storeA]],
      ["select public.begin_refund($1::uuid, 'system', 'x', null)", [order.id]],
      ["select public.complete_refund(gen_random_uuid(), 're_x', 'succeeded')", []],
      ["select public.create_checkout_payment($1::uuid, $2::uuid)", [order.id, IDS.userA]],
      ["select public.claim_payment_event('stripe', 'evt_x', 'x', '{}'::jsonb)", []],
      ["select public.sync_stripe_account('acct_storeA', true, true, true)", []],
      ["select public.sync_charge_refunded('pi_x', 1)", []],
    ];
    for (const user of [IDS.userA, IDS.staffA, IDS.ownerA]) {
      for (const [sql, params] of calls) {
        await expect(asUser(user, (q) => q.query(sql, params)), sql).rejects.toThrow(/permission denied/);
      }
    }
  });
});
