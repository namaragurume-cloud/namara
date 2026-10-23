import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { detectNewPickups, pickupPhase } from "@/lib/monitor";
import { ORDER_POLICY } from "@/lib/orders";
import { asService, asUser } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { createOrder, getPointsBalance, grantOrderPoints } from "@/server/services/orders";
import { requestUserRefund } from "@/server/services/payments";
import { getStoreMonitor, listMyOrders, listStoreOrders, maintainStoreOrders, markUnclaimedOrders, pickupOrder } from "@/server/services/pickup";
import { pickupLabel } from "@/lib/format";
import { ticketTiming } from "@/lib/ticket";
import { createProduct, createTestDb, getOrder, getProduct, IDS, setOrderStatus, setOrderWindow, shiftOrderWindow } from "./support/db";
import { connectStore, createPaidOrder, installFakeStripe, uninstallFakeStripe, type FakeStripe } from "./support/stripe";

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

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((e: AppError) => expect(e.code).toBe(code));
}

/** 受取時間を指定した paid の注文（Stripe を通さず状態だけ paid にする） */
async function paidOrder(opts: { startIn?: number; endIn?: number; userId?: string; storeId?: string } = {}) {
  const productId = await createProduct(opts.storeId ?? IDS.storeA, { startIn: -10, endIn: 60, quantity: 3 });
  const order = await createOrder(opts.userId ?? IDS.userA, productId, 1);
  await setOrderStatus(order.id, "paid");
  if (opts.startIn !== undefined || opts.endIn !== undefined) await shiftOrderWindow(order.id, opts.startIn ?? -10, opts.endIn ?? 60);
  return { order, productId };
}

const pickupEvents = (orderId: string) =>
  asService((q) =>
    q.query<{ actor: string; kind: string; user_id: string; metadata: Record<string, unknown> }>(
      "select actor, kind, user_id, metadata from public.pickup_events where order_id = $1 order by created_at",
      [orderId],
    ),
  );
const eventCount = (name: string) =>
  asService((q) => q.query<{ n: number }>("select count(*)::int as n from public.events where name = $1", [name])).then((r) => r[0].n);

describe("受取完了（本人のスワイプ）", () => {
  it("受取時間内の paid 注文は picked_up になり、受取時刻と受取イベント（swipe）が記録される", async () => {
    const { order } = await paidOrder();
    const res = await pickupOrder(IDS.userA, order.id, { ip: "203.0.113.5", userAgent: "Mozilla/5.0 Line/14", swipeMs: 640 });
    expect(res.result).toBe("picked_up");
    const row = await getOrder(order.id);
    expect(row.status).toBe("picked_up");
    expect(row.picked_up_at).not.toBeNull();
    const events = await pickupEvents(order.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actor: "user", kind: "swipe", user_id: IDS.userA });
    expect(events[0].metadata).toMatchObject({ method: "swipe", ip: "203.0.113.5", user_agent: "Mozilla/5.0 Line/14", swipe_ms: 640 });
    expect(await eventCount("pickup_completed")).toBe(1);
  });

  it("決済前・返金済み・キャンセル・未受取の注文は受け取れない", async () => {
    const pending = await createOrder(IDS.userA, await createProduct(IDS.storeA), 1);
    await expectAppError(pickupOrder(IDS.userA, pending.id), "order_not_paid");

    const cancelled = await createOrder(IDS.userA, await createProduct(IDS.storeA), 1);
    await setOrderStatus(cancelled.id, "cancelled");
    await expectAppError(pickupOrder(IDS.userA, cancelled.id), "not_pickupable");

    const refunded = await paidOrder();
    await setOrderStatus(refunded.order.id, "refunded");
    await expectAppError(pickupOrder(IDS.userA, refunded.order.id), "already_refunded");

    const unclaimed = await paidOrder();
    await setOrderStatus(unclaimed.order.id, "unclaimed");
    await expectAppError(pickupOrder(IDS.userA, unclaimed.order.id), "pickup_window_closed");

    expect(await asService((q) => q.query("select 1 from public.pickup_events"))).toHaveLength(0);
  });

  it("他人の注文は受け取れない", async () => {
    const { order } = await paidOrder();
    await expectAppError(pickupOrder(IDS.userB, order.id), "order_not_found");
    await expectAppError(pickupOrder(IDS.staffA, order.id), "order_not_found");
    expect((await getOrder(order.id)).status).toBe("paid");
  });

  it(`受取開始の${ORDER_POLICY.pickupEarlyGraceMinutes}分前より前・受取終了の${ORDER_POLICY.pickupLateGraceMinutes}分後より後は受け取れない`, async () => {
    const early = await paidOrder({ startIn: ORDER_POLICY.pickupEarlyGraceMinutes + 5, endIn: 90 });
    await expectAppError(pickupOrder(IDS.userA, early.order.id), "pickup_too_early");
    const late = await paidOrder({ startIn: -120, endIn: -(ORDER_POLICY.pickupLateGraceMinutes + 5) });
    await expectAppError(pickupOrder(IDS.userA, late.order.id), "pickup_window_closed");
    expect((await getOrder(early.order.id)).status).toBe("paid");
  });

  it("猶予時間内（受取開始の少し前・終了の少し後）なら受け取れる", async () => {
    const early = await paidOrder({ startIn: ORDER_POLICY.pickupEarlyGraceMinutes - 5, endIn: 90 });
    expect((await pickupOrder(IDS.userA, early.order.id)).result).toBe("picked_up");
    const late = await paidOrder({ startIn: -120, endIn: -(ORDER_POLICY.pickupLateGraceMinutes - 5) });
    expect((await pickupOrder(IDS.userA, late.order.id)).result).toBe("picked_up");
  });

  it("猶予は設定値（platform_settings）で変えられる", async () => {
    const { order } = await paidOrder({ startIn: 5, endIn: 60 });
    await asService((q) => q.query("update public.platform_settings set int_value = 0 where key = 'pickup_early_grace_minutes'"));
    await expectAppError(pickupOrder(IDS.userA, order.id), "pickup_too_early");
  });

  it("受取完了の分析イベント（pickup_completed）は、再実行・同時実行でも1回だけ", async () => {
    const { order } = await paidOrder();
    await Promise.all([pickupOrder(IDS.userA, order.id), pickupOrder(IDS.userA, order.id)]);
    expect((await pickupOrder(IDS.userA, order.id)).result).toBe("already_picked_up");
    expect(await eventCount("pickup_completed")).toBe(1);
  });

  it("二重にスワイプしても処理は1回だけ（状態・受取イベント・在庫・ポイントが変わらない）", async () => {
    const { order, productId } = await paidOrder();
    await grantOrderPoints(order.id);
    const stockBefore = (await getProduct(productId)).remaining_quantity;
    const results = await Promise.all([pickupOrder(IDS.userA, order.id), pickupOrder(IDS.userA, order.id)]);
    expect(results.map((r) => r.result).sort()).toEqual(["already_picked_up", "picked_up"]);
    expect((await pickupOrder(IDS.userA, order.id)).result).toBe("already_picked_up");
    expect(await pickupEvents(order.id)).toHaveLength(1);
    expect((await getProduct(productId)).remaining_quantity).toBe(stockBefore);
    expect(await getPointsBalance(IDS.userA)).toBe(30); // 受取では追加付与しない
  });

  it("受取済みの注文は返金状態にできず、ユーザー返金もできない", async () => {
    const { order } = await createPaidOrder(fake, IDS.userA, IDS.storeA, { startIn: -5, endIn: 60 });
    await pickupOrder(IDS.userA, order.id);
    await expectAppError(requestUserRefund(IDS.userA, order.id), "not_refundable");
  });
});

describe("未受取（unclaimed）", () => {
  it(`受取終了 + ${ORDER_POLICY.pickupLateGraceMinutes}分を過ぎた paid 注文だけが unclaimed になる`, async () => {
    const overdue = await paidOrder({ startIn: -120, endIn: -(ORDER_POLICY.pickupLateGraceMinutes + 1) });
    const inGrace = await paidOrder({ startIn: -120, endIn: -(ORDER_POLICY.pickupLateGraceMinutes - 5) });
    const pickedUp = await paidOrder({ startIn: -120, endIn: -(ORDER_POLICY.pickupLateGraceMinutes - 5) });
    await pickupOrder(IDS.userA, pickedUp.order.id);
    await shiftOrderWindow(pickedUp.order.id, -120, -(ORDER_POLICY.pickupLateGraceMinutes + 10));
    const refundedOld = await paidOrder({ startIn: -200, endIn: -100 });
    await setOrderStatus(refundedOld.order.id, "refunded");
    const pendingOld = await createOrder(IDS.userB, await createProduct(IDS.storeA, { startIn: -10, endIn: 60 }), 1);

    expect(await markUnclaimedOrders()).toBe(1);
    const row = await getOrder(overdue.order.id);
    expect(row.status).toBe("unclaimed");
    expect((await asService((q) => q.query<{ unclaimed_at: Date | null }>("select unclaimed_at from public.orders where id = $1", [overdue.order.id])))[0].unclaimed_at).not.toBeNull();
    expect((await getOrder(inGrace.order.id)).status).toBe("paid");
    expect((await getOrder(pickedUp.order.id)).status).toBe("picked_up");
    expect((await getOrder(refundedOld.order.id)).status).toBe("refunded");
    expect((await getOrder(pendingOld.id)).status).toBe("pending_payment");

    expect(await pickupEvents(overdue.order.id)).toMatchObject([{ actor: "system", kind: "auto_unclaimed", user_id: IDS.userA }]);
    expect(await eventCount("order_unclaimed")).toBe(1);
    expect(await markUnclaimedOrders()).toBe(0); // 二重に処理しない
  });

  it("未受取でも売上（決済）は取り消さず、返金もポイントの取り消しもしない。在庫も戻さない", async () => {
    const { order, productId } = await createPaidOrder(fake, IDS.userA, IDS.storeA, { quantity: 3 });
    await shiftOrderWindow(order.id, -120, -(ORDER_POLICY.pickupLateGraceMinutes + 1));
    const stock = (await getProduct(productId)).remaining_quantity;
    expect(await markUnclaimedOrders()).toBe(1);
    expect((await getOrder(order.id)).status).toBe("unclaimed");
    const [payment] = await asService((q) =>
      q.query<{ status: string }>("select status from public.payments where order_id = $1 and provider_payment_id is not null", [order.id]),
    );
    expect(payment.status).toBe("succeeded");
    expect(fake.refunds).toHaveLength(0);
    expect(await asService((q) => q.query("select 1 from public.refunds where order_id = $1", [order.id]))).toHaveLength(0);
    expect(await getPointsBalance(IDS.userA)).toBe(30);
    expect((await getProduct(productId)).remaining_quantity).toBe(stock);
  });

  it("画面を開いたときの店舗単位の処理は、その店舗の注文だけを更新し、短時間に繰り返さない", async () => {
    const late = -(ORDER_POLICY.pickupLateGraceMinutes + 1);
    const a = await paidOrder({ startIn: -120, endIn: late, storeId: IDS.storeA });
    const b = await paidOrder({ startIn: -120, endIn: late, storeId: IDS.storeB, userId: IDS.userB });
    expect(await maintainStoreOrders(IDS.storeA, { force: true })).toEqual({ expired_orders: 0, unclaimed_orders: 1 });
    expect((await getOrder(a.order.id)).status).toBe("unclaimed");
    expect((await getOrder(b.order.id)).status).toBe("paid");
    expect(await maintainStoreOrders(IDS.storeA)).toBeNull(); // 間隔内は実行しない
  });
});

describe("店舗モニター", () => {
  it("自店舗の今日の注文だけを、受取の区分つきで返す（お客様名は伏せる）", async () => {
    // 「今日」は JST の暦日。実際の時刻に依存しないよう、受取時間とモニターの時刻を固定する（JST 12:00）
    const now = new Date("2026-10-23T12:00:00+09:00");
    const active = await paidOrder();
    const upcoming = await paidOrder({ userId: IDS.userB });
    const picked = await paidOrder();
    await pickupOrder(IDS.userA, picked.order.id); // 受取完了は実際の時刻の受取時間内で行い、そのあと受取時間を固定時刻へ移す
    const other = await paidOrder({ storeId: IDS.storeB, userId: IDS.userB });
    const pending = await createOrder(IDS.ownerA, await createProduct(IDS.storeA), 1); // 決済前は出さない
    await setOrderWindow(active.order.id, "2026-10-23T11:50:00+09:00", "2026-10-23T13:00:00+09:00");
    await setOrderWindow(upcoming.order.id, "2026-10-23T13:00:00+09:00", "2026-10-23T14:00:00+09:00");
    await setOrderWindow(picked.order.id, "2026-10-23T11:50:00+09:00", "2026-10-23T13:00:00+09:00");
    await setOrderWindow(other.order.id, "2026-10-23T11:50:00+09:00", "2026-10-23T13:00:00+09:00");
    await setOrderWindow(pending.id, "2026-10-23T11:50:00+09:00", "2026-10-23T13:00:00+09:00");

    const snap = await getStoreMonitor(IDS.staffA, IDS.storeA, now);
    expect(snap.orders.map((o) => o.id).sort()).toEqual([active.order.id, upcoming.order.id, picked.order.id].sort());
    expect(snap.orders.some((o) => o.id === pending.id)).toBe(false);
    const phase = Object.fromEntries(snap.orders.map((o) => [o.id, o.phase]));
    expect(phase[upcoming.order.id]).toBe("upcoming");
    expect(phase[picked.order.id]).toBe("picked_up");
    expect(snap.orders.find((o) => o.id === active.order.id)!.customerName).toMatch(/^u＊+ 様$/);
  });

  it("他店舗のスタッフ・一般ユーザーは店舗モニターを見られない", async () => {
    await paidOrder();
    await expectAppError(getStoreMonitor(IDS.staffB, IDS.storeA), "forbidden");
    await expectAppError(getStoreMonitor(IDS.userA, IDS.storeA), "forbidden");
    await expectAppError(listStoreOrders(IDS.staffB, IDS.storeA), "forbidden");
  });

  /**
   * 日付の境界（JST の暦日）。以前は「現在時刻 + 60分」に受取開始の注文を作っていたため、
   * JST 23 時台に実行すると受取開始が翌日になり「今日の注文」から外れてテストが失敗していた。
   * ここでは受取時間・モニターの時刻とも固定し、境界の前後の表示を確かめる。
   */
  describe("日付の境界（JST の固定時刻）", () => {
    const jst = (s: string) => new Date(`${s}+09:00`);
    async function fixtures() {
      // 夕方に受取が終わった注文（未受取）・日付をまたぐ受取時間の注文・翌日 0:14 から受け取る注文
      const evening = await paidOrder();
      const crossing = await paidOrder({ userId: IDS.userB });
      const nextDay = await paidOrder({ userId: IDS.ownerA });
      await setOrderWindow(evening.order.id, "2026-10-23T21:00:00+09:00", "2026-10-23T22:30:00+09:00");
      await setOrderWindow(crossing.order.id, "2026-10-23T23:30:00+09:00", "2026-10-24T00:30:00+09:00");
      await setOrderWindow(nextDay.order.id, "2026-10-24T00:14:00+09:00", "2026-10-24T01:14:00+09:00");
      return { evening: evening.order.id, crossing: crossing.order.id, nextDay: nextDay.order.id };
    }
    const phasesAt = async (at: string) =>
      Object.fromEntries((await getStoreMonitor(IDS.staffA, IDS.storeA, jst(at))).orders.map((o) => [o.id, o.phase]));

    it("JST 22:59: 今日の注文（夕方の未受取・日付をまたぐ受取前）。翌日の注文はまだ出さない", async () => {
      const f = await fixtures();
      expect(await phasesAt("2026-10-23T22:59:00")).toEqual({ [f.evening]: "unclaimed", [f.crossing]: "upcoming" });
    });

    it("JST 23:59: 日付をまたぐ注文は受取時間中。翌日 0:14 からの注文は翌日の扱い（以前の失敗の再現条件）", async () => {
      const f = await fixtures();
      expect(await phasesAt("2026-10-23T23:59:00")).toEqual({ [f.evening]: "unclaimed", [f.crossing]: "active" });
    });

    it("JST 00:00: 日付が変わると、前日に終わった注文は外れ、日付をまたぐ注文と今日 0:14 からの注文が出る", async () => {
      const f = await fixtures();
      expect(await phasesAt("2026-10-24T00:00:00")).toEqual({ [f.crossing]: "active", [f.nextDay]: "upcoming" });
    });

    it("JST 00:10 / 00:15: 0:14 からの注文は受取開始の10分前から受取時間中", async () => {
      const f = await fixtures();
      expect(await phasesAt("2026-10-24T00:03:00")).toEqual({ [f.crossing]: "active", [f.nextDay]: "upcoming" });
      expect(await phasesAt("2026-10-24T00:10:00")).toEqual({ [f.crossing]: "active", [f.nextDay]: "active" });
      expect(await phasesAt("2026-10-24T00:15:00")).toEqual({ [f.crossing]: "active", [f.nextDay]: "active" });
    });

    it("日付をまたぐ受取時間: 終了 + 15分（00:45）まで受取時間中、その後は未受取。表示は「本日」「明日」が境界で切り替わる", async () => {
      const f = await fixtures();
      expect((await phasesAt("2026-10-24T00:45:00"))[f.crossing]).toBe("active");
      expect((await phasesAt("2026-10-24T00:46:00"))[f.crossing]).toBe("unclaimed");
      expect(pickupLabel("2026-10-24T00:14:00+09:00", "2026-10-24T01:14:00+09:00", jst("2026-10-23T23:59:00"))).toBe("明日 00:14〜01:14");
      expect(pickupLabel("2026-10-24T00:14:00+09:00", "2026-10-24T01:14:00+09:00", jst("2026-10-24T00:00:00"))).toBe("本日 00:14〜01:14");
      const crossing = {
        pickupStartAt: "2026-10-23T23:30:00+09:00",
        pickupEndAt: "2026-10-24T00:30:00+09:00",
        pickupOpensAt: "2026-10-23T23:20:00+09:00",
        pickupClosesAt: "2026-10-24T00:45:00+09:00",
      };
      expect(ticketTiming(crossing, jst("2026-10-23T23:59:00"))).toMatchObject({ kind: "active", note: "受取終了まであと31分" });
      expect(ticketTiming(crossing, jst("2026-10-24T00:40:00"))).toMatchObject({ kind: "grace", canSwipe: true });
      expect(ticketTiming(crossing, jst("2026-10-24T00:46:00"))).toMatchObject({ kind: "closed", canSwipe: false });
    });
  });

  it("受取完了で version が変わる（ポーリングの差分検知）", async () => {
    const { order } = await paidOrder();
    const before = await getStoreMonitor(IDS.staffA, IDS.storeA);
    expect((await getStoreMonitor(IDS.staffA, IDS.storeA)).version).toBe(before.version);
    await pickupOrder(IDS.userA, order.id);
    const after = await getStoreMonitor(IDS.staffA, IDS.storeA);
    expect(after.version).not.toBe(before.version);
    expect(after.orders[0].status).toBe("picked_up");
  });

  it("新しい受取完了だけを検出し、初回表示や同じ注文では通知しない", () => {
    const initial = detectNewPickups(null, [
      { id: "a", status: "picked_up" },
      { id: "b", status: "paid" },
    ]);
    expect(initial.fresh).toEqual([]); // 初回表示の受取完了では鳴らさない
    const second = detectNewPickups(initial.known, [
      { id: "a", status: "picked_up" },
      { id: "b", status: "picked_up" },
    ]);
    expect(second.fresh).toEqual(["b"]);
    const third = detectNewPickups(second.known, [
      { id: "a", status: "picked_up" },
      { id: "b", status: "picked_up" },
    ]);
    expect(third.fresh).toEqual([]); // 同じ注文で二重に鳴らさない
  });

  it("受取の区分（受取前・受取時間中・未受取）は猶予を含めて判定する", () => {
    const now = Date.parse("2026-10-26T09:00:00Z");
    const at = (min: number) => new Date(now + min * 60_000).toISOString();
    expect(pickupPhase({ status: "paid", pickupStartAt: at(11), pickupEndAt: at(60) }, now)).toBe("upcoming");
    expect(pickupPhase({ status: "paid", pickupStartAt: at(9), pickupEndAt: at(60) }, now)).toBe("active");
    expect(pickupPhase({ status: "paid", pickupStartAt: at(-60), pickupEndAt: at(-14) }, now)).toBe("active");
    expect(pickupPhase({ status: "paid", pickupStartAt: at(-60), pickupEndAt: at(-16) }, now)).toBe("unclaimed");
    expect(pickupPhase({ status: "picked_up", pickupStartAt: at(-60), pickupEndAt: at(-16) }, now)).toBe("picked_up");
  });
});

describe("ユーザーの注文履歴・RLS", () => {
  it("区分ごとに自分の注文だけが表示される", async () => {
    const ready = await paidOrder();
    const done = await paidOrder();
    await pickupOrder(IDS.userA, done.order.id);
    await paidOrder({ userId: IDS.userB });
    expect((await listMyOrders(IDS.userA, "ready")).map((o) => o.id)).toEqual([ready.order.id]);
    expect((await listMyOrders(IDS.userA, "picked_up")).map((o) => o.id)).toEqual([done.order.id]);
    expect(await listMyOrders(IDS.userA, "unclaimed")).toEqual([]);
  });

  it("受取イベントは本人と注文先の店舗メンバーだけが見られ、直接は書き込めない", async () => {
    const { order } = await paidOrder();
    await pickupOrder(IDS.userA, order.id);
    expect(await asUser(IDS.userA, (q) => q.query("select * from public.pickup_events"))).toHaveLength(1);
    expect(await asUser(IDS.staffA, (q) => q.query("select * from public.pickup_events"))).toHaveLength(1);
    expect(await asUser(IDS.userB, (q) => q.query("select * from public.pickup_events"))).toHaveLength(0);
    expect(await asUser(IDS.staffB, (q) => q.query("select * from public.pickup_events"))).toHaveLength(0);
    for (const sql of [
      "select public.mark_unclaimed_orders()",
      `select public.maintain_store_orders('${IDS.storeA}'::uuid)`,
      `insert into public.pickup_events (order_id, user_id, actor, kind) values ('${order.id}', '${IDS.userA}', 'user', 'swipe')`,
      `update public.orders set status = 'picked_up' where id = '${order.id}'`,
    ]) {
      await expect(asUser(IDS.staffA, (q) => q.query(sql)), sql).rejects.toThrow(/permission denied/);
    }
  });
});
