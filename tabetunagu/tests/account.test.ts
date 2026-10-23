import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { getMyAccountSummary, listMyOrderHistory, listMyPointHistory } from "@/server/services/account";
import { createOrder, grantOrderPoints } from "@/server/services/orders";
import { requestUserRefund } from "@/server/services/payments";
import { createProduct, createTestDb, IDS, setOrderStatus, setOrderWindow } from "./support/db";
import { connectStore, createPaidOrder, installFakeStripe, uninstallFakeStripe, type FakeStripe } from "./support/stripe";

/** マイページ・注文履歴・ポイント履歴（本人の行だけ・台帳が正） */
let driver: Driver | undefined;
let fake: FakeStripe;

beforeEach(async () => {
  await driver?.close();
  driver = await createTestDb();
  fake = installFakeStripe();
  await connectStore(IDS.storeA, "acct_storeA");
  await connectStore(IDS.storeB, "acct_storeB");
});
afterEach(() => uninstallFakeStripe());
afterAll(async () => {
  await driver?.close();
});

async function orderWith(status: string, userId: string = IDS.userA) {
  const productId = await createProduct(IDS.storeA, { startIn: -10, endIn: 60, quantity: 5 });
  const order = await createOrder(userId, productId, 1);
  // 許可された遷移だけができるため、受取完了・未受取・返金済みは paid を経由する
  if (["picked_up", "unclaimed", "refunded"].includes(status)) await setOrderStatus(order.id, "paid");
  if (status !== "pending_payment") await setOrderStatus(order.id, status);
  return order.id;
}

describe("マイページの集計", () => {
  it("注文・ポイント・お気に入りが0件のとき（空状態）", async () => {
    const s = await getMyAccountSummary(IDS.userA);
    expect(s).toMatchObject({ points: 0, pickedUpCount: 0, orderCount: 0, paidOrders: [], recentOrders: [], favorites: [], favoriteCount: 0 });
    expect(await listMyOrderHistory(IDS.userA, "all")).toEqual({ items: [], hasMore: false });
    expect(await listMyPointHistory(IDS.userA)).toEqual([]);
  });

  it("過去の食べつなぎは受取完了だけを数える（未受取・返金・キャンセル・決済待ち・受取待ちは含めない）", async () => {
    for (const st of ["picked_up", "picked_up", "unclaimed", "refunded", "cancelled", "pending_payment", "paid"]) await orderWith(st);
    const s = await getMyAccountSummary(IDS.userA);
    expect(s.pickedUpCount).toBe(2);
    expect(s.orderCount).toBe(7);
    expect(s.paidOrders).toHaveLength(1);
    // 最近の注文は受取待ち（上の欄に出す）以外の新しい3件
    expect(s.recentOrders).toHaveLength(3);
    expect(s.recentOrders.every((o) => o.status !== "paid")).toBe(true);
  });

  it("受取待ちは受取開始の近い順（固定時刻）", async () => {
    const a = await orderWith("paid");
    const b = await orderWith("paid");
    const c = await orderWith("paid");
    await setOrderWindow(a, "2026-10-23T21:00:00+09:00", "2026-10-23T22:00:00+09:00");
    await setOrderWindow(b, "2026-10-23T19:00:00+09:00", "2026-10-23T20:30:00+09:00");
    await setOrderWindow(c, "2026-10-23T20:00:00+09:00", "2026-10-23T21:00:00+09:00");
    const s = await getMyAccountSummary(IDS.userA, new Date("2026-10-23T19:45:00+09:00"));
    expect(s.paidOrders.map((o) => o.id)).toEqual([b, c, a]);
  });

  it("他のユーザーの注文・ポイント・お気に入りは出さない", async () => {
    await orderWith("paid", IDS.userB);
    await orderWith("picked_up", IDS.userB);
    await asService((q) => q.query("insert into public.favorites (user_id, store_id) values ($1, $2)", [IDS.userB, IDS.storeA]));
    const s = await getMyAccountSummary(IDS.userA);
    expect(s).toMatchObject({ orderCount: 0, pickedUpCount: 0, paidOrders: [], favoriteCount: 0 });
    expect((await listMyOrderHistory(IDS.userA, "all")).items).toEqual([]);
    expect((await listMyOrderHistory(IDS.userB, "all")).items).toHaveLength(2);
  });
});

describe("ポイント（台帳が正）", () => {
  it("残高は台帳の合計。user_stats.points_balance（旧互換値）は使わない。履歴は獲得・取消を新しい順", async () => {
    const { order } = await createPaidOrder(fake, IDS.userA, IDS.storeA, { startIn: 60, endIn: 120 });
    await grantOrderPoints(order.id); // 二重付与しない（冪等）
    // 旧互換値を台帳と違う値にしても、表示は台帳から
    await asService((q) => q.query("update public.user_stats set points_balance = 9999 where user_id = $1", [IDS.userA]));
    expect((await getMyAccountSummary(IDS.userA)).points).toBe(30);
    expect((await listMyPointHistory(IDS.userA)).map((h) => [h.type, h.amount])).toEqual([["earned", 30]]);

    await requestUserRefund(IDS.userA, order.id);
    expect((await getMyAccountSummary(IDS.userA)).points).toBe(0);
    const history = await listMyPointHistory(IDS.userA);
    expect(history.map((h) => [h.type, h.amount])).toEqual([
      ["revoked", -30],
      ["earned", 30],
    ]);
    // 内部の理由・注文 ID は返さない
    expect(Object.keys(history[0]).sort()).toEqual(["amount", "createdAt", "id", "type"]);
  });
});

describe("注文履歴", () => {
  it("新しい注文が上。絞り込み（受取待ち・完了・その他）", async () => {
    const ids: Record<string, string> = {};
    for (const st of ["paid", "picked_up", "unclaimed", "cancelled", "pending_payment"]) {
      ids[st] = await orderWith(st);
      await asService((q) => q.query("select pg_sleep(0.01)"));
    }
    const all = (await listMyOrderHistory(IDS.userA, "all")).items.map((o) => o.status);
    expect(all).toEqual(["pending_payment", "cancelled", "unclaimed", "picked_up", "paid"]);
    expect((await listMyOrderHistory(IDS.userA, "ready")).items.map((o) => o.id)).toEqual([ids.paid]);
    expect((await listMyOrderHistory(IDS.userA, "done")).items.map((o) => o.id)).toEqual([ids.picked_up]);
    expect((await listMyOrderHistory(IDS.userA, "other")).items.map((o) => o.status).sort()).toEqual(["cancelled", "pending_payment", "unclaimed"]);
    const pending = (await listMyOrderHistory(IDS.userA, "other")).items.find((o) => o.status === "pending_payment")!;
    expect(pending.payable).toBe(true);
  });

  it("返金済みは返金額・返金日時を返す（Stripe の ID は返さない）", async () => {
    const { order } = await createPaidOrder(fake, IDS.userA, IDS.storeA, { startIn: 60, endIn: 120 });
    await requestUserRefund(IDS.userA, order.id);
    const [card] = (await listMyOrderHistory(IDS.userA, "other")).items;
    expect(card.status).toBe("refunded");
    expect(card.refund).toMatchObject({ amount: card.total, status: "succeeded" });
    expect(JSON.stringify(card)).not.toMatch(/pi_|re_|cs_|acct_/);
  });

  it("ページ単位で取得する（20件ずつ）", async () => {
    const productId = await createProduct(IDS.storeA, { startIn: -10, endIn: 60, quantity: 30 });
    // 同じ商品は決済待ちを重ねられないため、作成のたびにキャンセル扱いにする
    for (let i = 0; i < 21; i++) {
      const order = await createOrder(IDS.userA, productId, 1);
      await setOrderStatus(order.id, "cancelled");
    }
    const first = await listMyOrderHistory(IDS.userA, "all");
    expect(first.items).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    const second = await listMyOrderHistory(IDS.userA, "all", { page: 2 });
    expect(second.items).toHaveLength(1);
    expect(second.hasMore).toBe(false);
  });
});
