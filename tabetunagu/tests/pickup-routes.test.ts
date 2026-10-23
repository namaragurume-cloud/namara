import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { createTestDb, getOrder, IDS } from "./support/db";
import { connectStore, createPaidOrder, installFakeStripe, uninstallFakeStripe, type FakeStripe } from "./support/stripe";

/**
 * ルートハンドラ・Server Action のテスト。ログイン状態（Cookie）だけを差し替え、
 * 店舗メンバーかどうかは DB の store_members から判定する（本番と同じ考え方）。
 */
const session = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest-agent", "x-forwarded-for": "198.51.100.7, 10.0.0.1" }),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/server/auth/viewer", async () => {
  const { asService: svc } = await import("@/server/db");
  const { AppError } = await import("@/lib/errors");
  const getViewer = async () => {
    if (!session.userId) return null;
    const memberships = await svc((q) =>
      q.query<{ store_id: string; role: "owner" | "staff" }>("select store_id, role::text as role from public.store_members where user_id = $1", [
        session.userId,
      ]),
    );
    return {
      id: session.userId,
      displayName: "test",
      avatarUrl: null,
      lineLinked: false,
      isDemo: false,
      isAdmin: false,
      memberships: memberships.map((m) => ({ storeId: m.store_id, storeName: "", storeSlug: "", role: m.role, plan: "free", status: "active" })),
    };
  };
  return {
    getViewer,
    assertStoreMember: async (storeId: string) => {
      const viewer = await getViewer();
      const store = viewer?.memberships.find((m) => m.storeId === storeId);
      if (!viewer || !store) throw new AppError("forbidden");
      return { viewer, store };
    },
  };
});

const { GET: monitorGET } = await import("@/app/api/store/monitor/route");
const { pickupOrderAction, storeRefundOrderAction } = await import("@/app/actions/pickup");

let driver: Driver | undefined;
let fake: FakeStripe;

beforeEach(async () => {
  await driver?.close();
  driver = await createTestDb();
  fake = installFakeStripe();
  await connectStore(IDS.storeA, "acct_storeA");
  session.userId = null;
});

afterEach(() => uninstallFakeStripe());

afterAll(async () => {
  await driver?.close();
});

const form = (data: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
};

describe("受取完了の Server Action", () => {
  it("本人のスワイプで受取完了になり、IP・User-Agent・スワイプ時間を受取イベントに残す", async () => {
    const { order } = await createPaidOrder(fake, IDS.userA, IDS.storeA, { startIn: -5, endIn: 60 });
    session.userId = IDS.userA;
    expect(await pickupOrderAction(order.id, 720)).toMatchObject({ ok: true, code: "picked_up" });
    expect((await getOrder(order.id)).status).toBe("picked_up");
    const [ev] = await asService((q) => q.query<{ metadata: Record<string, unknown> }>("select metadata from public.pickup_events where order_id = $1", [order.id]));
    expect(ev.metadata).toMatchObject({ ip: "198.51.100.7", user_agent: "vitest-agent", swipe_ms: 720 });

    session.userId = IDS.userB;
    expect(await pickupOrderAction(order.id, 500)).toMatchObject({ ok: false, code: "order_not_found" });
    session.userId = null;
    expect(await pickupOrderAction(order.id, 500)).toMatchObject({ ok: false, code: "not_authenticated" });
  });
});

describe("店舗都合の返金 UI（Server Action）", () => {
  it("理由が必須", async () => {
    const { order } = await createPaidOrder(fake, IDS.userA, IDS.storeA, { startIn: 30, endIn: 90 });
    session.userId = IDS.staffA;
    const res = await storeRefundOrderAction(null, form({ storeId: IDS.storeA, orderId: order.id, reason: "  " }));
    expect(res).toMatchObject({ ok: false, code: "reason_required" });
    expect((await getOrder(order.id)).status).toBe("paid");
  });

  it("自店舗のメンバーは返金でき、他店舗のメンバー・一般ユーザーはできない", async () => {
    const { order } = await createPaidOrder(fake, IDS.userA, IDS.storeA, { startIn: 30, endIn: 90 });
    session.userId = IDS.staffB;
    // 自分の店舗 ID を名乗っても、他店舗の注文は DB 側で拒否される
    expect(await storeRefundOrderAction(null, form({ storeId: IDS.storeB, orderId: order.id, reason: "品切れ" }))).toMatchObject({
      ok: false,
      code: "forbidden",
    });
    expect(await storeRefundOrderAction(null, form({ storeId: IDS.storeA, orderId: order.id, reason: "品切れ" }))).toMatchObject({
      ok: false,
      code: "forbidden",
    });
    session.userId = IDS.userB;
    expect(await storeRefundOrderAction(null, form({ storeId: IDS.storeA, orderId: order.id, reason: "品切れ" }))).toMatchObject({ ok: false });
    expect((await getOrder(order.id)).status).toBe("paid");
    expect(fake.refunds).toHaveLength(0);

    session.userId = IDS.staffA;
    expect(await storeRefundOrderAction(null, form({ storeId: IDS.storeA, orderId: order.id, reason: "品切れのため" }))).toMatchObject({ ok: true });
    expect((await getOrder(order.id)).status).toBe("refunded");
    expect(fake.refunds).toHaveLength(1);
  });
});

describe("店舗モニター API（ポーリング）", () => {
  const get = (storeId: string, v?: string) =>
    monitorGET(new Request(`http://localhost/api/store/monitor?store=${storeId}${v ? `&v=${encodeURIComponent(v)}` : ""}`));

  it("自店舗のスナップショットを返し、変化がなければ unchanged だけを返す", async () => {
    const { order } = await createPaidOrder(fake, IDS.userA, IDS.storeA, { startIn: -5, endIn: 60 });
    session.userId = IDS.staffA;
    const first = await (await get(IDS.storeA)).json();
    expect(first.snapshot.orders.map((o: { id: string }) => o.id)).toEqual([order.id]);
    const second = await (await get(IDS.storeA, first.snapshot.version)).json();
    expect(second).toMatchObject({ ok: true, unchanged: true });

    session.userId = IDS.userA;
    await pickupOrderAction(order.id, 600);
    session.userId = IDS.staffA;
    const third = await (await get(IDS.storeA, first.snapshot.version)).json();
    expect(third.snapshot.orders[0].status).toBe("picked_up");
  });

  it("他店舗・未ログインでは見られない", async () => {
    await createPaidOrder(fake, IDS.userA, IDS.storeA, { startIn: -5, endIn: 60 });
    session.userId = IDS.staffB;
    expect((await get(IDS.storeA)).status).toBe(403);
    session.userId = IDS.userA;
    expect((await get(IDS.storeA)).status).toBe(403);
    session.userId = null;
    expect((await get(IDS.storeA)).status).toBe(401);
  });
});
