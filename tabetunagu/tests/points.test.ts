import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { PRICING } from "@/lib/fees";
import { asService, asUser, setDriverForTesting } from "@/server/db";
import { runMigrations } from "@/server/db/migrate";
import { createPgliteDriver } from "@/server/db/pglite";
import type { Driver } from "@/server/db/types";
import { createOrder, getPointsBalance, grantOrderPoints, revokeOrderPoints } from "@/server/services/orders";
import { getMyStats } from "@/server/services/reservations";
import { createProduct, createTestDb, IDS, setOrderStatus } from "./support/db";

let driver: Driver | undefined;

beforeEach(async () => {
  await driver?.close();
  driver = await createTestDb();
});

afterAll(async () => {
  await driver?.close();
});

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((e: AppError) => expect(e.code).toBe(code));
}

async function paidOrder(userId: string = IDS.userA) {
  const order = await createOrder(userId, await createProduct(IDS.storeA), 1);
  await setOrderStatus(order.id, "paid");
  return order.id;
}

async function ledger(userId: string) {
  return asService((q) =>
    q.query<{ type: string; amount: number; reason: string; order_id: string | null }>(
      "select type, amount, reason, order_id from public.points_transactions where user_id = $1 order by created_at, id",
      [userId],
    ),
  );
}

describe("つなぐポイント（台帳）", () => {
  it("paid の注文に 30pt を earned として付与できる", async () => {
    const orderId = await paidOrder();
    expect(await grantOrderPoints(orderId)).toEqual({ granted: true, points: PRICING.orderPoints });
    expect(await ledger(IDS.userA)).toEqual([
      { type: "earned", amount: 30, reason: "order_paid", order_id: orderId },
    ]);
    expect(await getPointsBalance(IDS.userA)).toBe(30);
  });

  it("pending_payment の注文には付与できない", async () => {
    const order = await createOrder(IDS.userA, await createProduct(IDS.storeA), 1);
    await expectAppError(grantOrderPoints(order.id), "order_not_paid");
    expect(await getPointsBalance(IDS.userA)).toBe(0);
  });

  it("同じ注文に二重付与できない（関数は何もしない・直接の挿入も一意制約で拒否）", async () => {
    const orderId = await paidOrder();
    await grantOrderPoints(orderId);
    expect(await grantOrderPoints(orderId)).toEqual({ granted: false, points: 0 });
    await expect(
      asService((q) =>
        q.query(
          "insert into public.points_transactions (user_id, order_id, amount, type, reason) values ($1, $2, 30, 'earned', 'order_paid')",
          [IDS.userA, orderId],
        ),
      ),
    ).rejects.toThrow();
    expect(await getPointsBalance(IDS.userA)).toBe(30);
  });

  it("全額返金で -30pt の revoked を記録し、残高は 0 になる。二重には取り消さない", async () => {
    const orderId = await paidOrder();
    await grantOrderPoints(orderId);
    await expectAppError(revokeOrderPoints(orderId), "order_not_refunded"); // 返金前は取り消せない

    await setOrderStatus(orderId, "refunded");
    expect(await revokeOrderPoints(orderId)).toEqual({ revoked: true, points: -30 });
    expect(await revokeOrderPoints(orderId)).toEqual({ revoked: false, points: 0 });
    expect((await ledger(IDS.userA)).map((r) => [r.type, r.amount])).toEqual([
      ["earned", 30],
      ["revoked", -30],
    ]);
    expect(await getPointsBalance(IDS.userA)).toBe(0);
  });

  it("付与していない注文は取り消さない", async () => {
    const orderId = await paidOrder();
    await setOrderStatus(orderId, "refunded");
    expect(await revokeOrderPoints(orderId)).toEqual({ revoked: false, points: 0 });
    expect(await ledger(IDS.userA)).toEqual([]);
  });

  it("残高 VIEW は本人の台帳の合計（他人の残高・台帳は見えない）", async () => {
    const a1 = await paidOrder(IDS.userA);
    const a2 = await paidOrder(IDS.userA);
    const b1 = await paidOrder(IDS.userB);
    for (const id of [a1, a2, b1]) await grantOrderPoints(id);
    await setOrderStatus(a2, "refunded");
    await revokeOrderPoints(a2);

    const seenByA = await asUser(IDS.userA, (q) =>
      q.query<{ user_id: string; balance: number; earned_total: number }>(
        "select user_id, balance, earned_total from public.user_points_balances",
      ),
    );
    expect(seenByA).toEqual([{ user_id: IDS.userA, balance: 30, earned_total: 60 }]);
    expect(await getPointsBalance(IDS.userB)).toBe(30);
    const otherLedger = await asUser(IDS.userA, (q) =>
      q.query("select * from public.points_transactions where user_id = $1", [IDS.userB]),
    );
    expect(otherLedger).toHaveLength(0);
    // マイページの残高も台帳から
    expect((await getMyStats(IDS.userA)).points).toBe(30);
  });

  it("台帳は追記のみ（更新できない）。一般ユーザーは付与・取り消しを実行できない", async () => {
    const orderId = await paidOrder();
    await grantOrderPoints(orderId);
    await expect(
      asService((q) => q.query("update public.points_transactions set amount = 1000 where order_id = $1", [orderId])),
    ).rejects.toThrow();
    await expect(
      asUser(IDS.userA, (q) => q.query("select public.grant_order_points($1::uuid)", [orderId])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(IDS.userA, (q) =>
        q.query("insert into public.points_transactions (user_id, amount, type, reason) values ($1, 999, 'earned', 'adjustment')", [
          IDS.userA,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("旧QRフローの付与（reason = checkin）は earned として台帳に入る", async () => {
    await asService((q) =>
      q.query("insert into public.points_transactions (user_id, amount, reason) values ($1, 10, 'checkin')", [IDS.userA]),
    );
    expect((await ledger(IDS.userA))[0].type).toBe("earned");
    expect(await getPointsBalance(IDS.userA)).toBe(10);
  });
});

describe("ポイント台帳のマイグレーション", () => {
  it("既存の user_stats.points_balance と台帳の差額を adjusted で補い、残高を変えない", async () => {
    const root = process.cwd();
    const files = (await readdir(path.join(root, "supabase/migrations"))).filter((f) => f.endsWith(".sql")).sort();
    const [init, ...v2] = files;
    expect(v2.length).toBeGreaterThan(0);

    // v2 適用前（初期スキーマのみ）の DB に旧データを入れる
    const db = await createPgliteDriver();
    try {
      await db.exec(await readFile(path.join(root, "supabase/local/bootstrap.sql"), "utf8"));
      await db.exec(`create table public.schema_migrations (version text primary key, applied_at timestamptz not null default now());
        ${await readFile(path.join(root, "supabase/migrations", init), "utf8")}
        insert into public.schema_migrations (version) values ('${init.replace(/\.sql$/, "")}');`);
      setDriverForTesting(db);
      await asService(async (q) => {
        await q.query("insert into public.users (id, display_name) values ($1, 'A'), ($2, 'B'), ($3, 'C')", [
          IDS.userA,
          IDS.userB,
          IDS.staffA,
        ]);
        // A: 台帳と一致（10pt × 2） / B: 台帳なしで残高 50 / C: 台帳 10 に対し残高 0
        await q.query(
          `insert into public.points_transactions (user_id, amount, reason) values ($1, 10, 'checkin'), ($1, 10, 'checkin'), ($2, 10, 'checkin')`,
          [IDS.userA, IDS.staffA],
        );
        await q.query(
          `insert into public.user_stats (user_id, points_balance) values ($1, 20), ($2, 50), ($3, 0)`,
          [IDS.userA, IDS.userB, IDS.staffA],
        );
      });

      const applied = await runMigrations(db, { bootstrap: false });
      expect(applied).toEqual(v2.map((f) => f.replace(/\.sql$/, "")));

      const balances = await asService((q) =>
        q.query<{ user_id: string; balance: number }>("select user_id, balance from public.user_points_balances order by user_id"),
      );
      expect(Object.fromEntries(balances.map((b) => [b.user_id, b.balance]))).toEqual({
        [IDS.userA]: 20,
        [IDS.userB]: 50,
        [IDS.staffA]: 0,
      });
      const adjustments = await asService((q) =>
        q.query<{ user_id: string; amount: number }>(
          "select user_id, amount from public.points_transactions where reason = 'balance_migration' order by user_id",
        ),
      );
      expect(adjustments).toEqual([
        { user_id: IDS.userB, amount: 50 },
        { user_id: IDS.staffA, amount: -10 },
      ]);
      const types = await asService((q) =>
        q.query<{ type: string }>("select distinct type from public.points_transactions where reason = 'checkin'"),
      );
      expect(types).toEqual([{ type: "earned" }]);
    } finally {
      await db.close();
    }
  });
});
