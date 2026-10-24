import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { createProduct, createTestDb, IDS } from "./support/db";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/server/auth/viewer", async () => {
  const { asService: svc } = await import("@/server/db");
  const { AppError } = await import("@/lib/errors");
  return {
    getViewer: async () => (session.userId ? { id: session.userId } : null),
    assertStoreMember: async (storeId: string, opts: { owner?: boolean } = {}) => {
      if (!session.userId) throw new AppError("forbidden");
      const [m] = await svc((q) =>
        q.query<{ role: string }>("select role::text as role from public.store_members where user_id = $1 and store_id = $2", [session.userId, storeId]),
      );
      if (!m || (opts.owner && m.role !== "owner")) throw new AppError("forbidden");
      return { viewer: { id: session.userId }, store: { storeId, role: m.role } };
    },
  };
});
const { changePlanAction } = await import("@/app/actions/store");
const { reserveAction } = await import("@/app/actions/user");

/** PoC 公開前の総点検（STEP 12）で見つけた問題の再発防止 */

describe("管理画面: 各ページで管理者を確認する（レイアウトだけに頼らない）", () => {
  // レイアウトの確認は部分レンダリング（クライアント遷移の RSC リクエスト）では実行されず、ページの内容が返ってしまう
  function pages(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? pages(p) : name === "page.tsx" ? [p] : [];
    });
  }
  const files = pages(join(process.cwd(), "src/app/admin"));
  it.each(files.map((f) => [f.replace(process.cwd() + "/", "")]))("%s", (file) => {
    expect(readFileSync(join(process.cwd(), file), "utf8")).toMatch(/await requireAdmin\(/);
  });
  it("対象のページがある", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });
});

const KEYS = ["ENABLE_V2_CHECKOUT", "APP_ENV"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
let driver: Driver | undefined;
const form = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
};

describe("v2（事前決済）が ON のとき", () => {
  beforeEach(async () => {
    await driver?.close();
    driver = await createTestDb();
    process.env.APP_ENV = "preview";
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
  afterAll(async () => {
    await driver?.close();
  });

  it("店舗オーナーが STANDARD（手数料 8%）に切り替えられない（月額課金が未実装のため）。OFF のときは従来どおり", async () => {
    session.userId = IDS.ownerA;
    process.env.ENABLE_V2_CHECKOUT = "true";
    expect(await changePlanAction(null, form({ storeId: IDS.storeA, plan: "standard" }))).toMatchObject({ ok: false, code: "forbidden" });
    const plan = async () =>
      (await asService((q) => q.query<{ plan_code: string }>("select plan_code from public.stores where id = $1", [IDS.storeA])))[0].plan_code;
    expect(await plan()).toBe("free");
    process.env.ENABLE_V2_CHECKOUT = "false";
    expect(await changePlanAction(null, form({ storeId: IDS.storeA, plan: "standard" }))).toMatchObject({ ok: true });
    expect(await plan()).toBe("standard");
  });

  it("旧フローの予約（店頭払い）を受け付けない（在庫を確保させない）", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 3 });
    session.userId = IDS.userA;
    process.env.ENABLE_V2_CHECKOUT = "true";
    expect(await reserveAction(null, form({ productId, quantity: "1" }))).toMatchObject({ ok: false });
    const [p] = await asService((q) => q.query<{ remaining_quantity: number }>("select remaining_quantity from public.products where id = $1", [productId]));
    expect(p.remaining_quantity).toBe(3);
    const [r] = await asService((q) => q.query<{ count: number }>("select count(*)::int as count from public.reservations"));
    expect(r.count).toBe(0);
  });
});
