import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ymd } from "@/lib/format";
import { jstHour } from "@/lib/time";
import { groupRelistSources, previousTimes, quickPickupLabel, quickRelistSchema, resolvePrices, type RelistSourceRow } from "@/lib/quick-relist";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { getRelistSource, listRelistSources, quickRelist } from "@/server/services/quick-relist";
import { getStoreDashboard } from "@/server/services/store";
import { createProduct, createTestDb, IDS } from "./support/db";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/server/auth/viewer", async () => {
  const { asService: svc } = await import("@/server/db");
  const { AppError } = await import("@/lib/errors");
  return {
    assertStoreMember: async (storeId: string) => {
      if (!session.userId) throw new AppError("forbidden");
      const [m] = await svc((q) =>
        q.query<{ role: string }>("select role::text as role from public.store_members where user_id = $1 and store_id = $2", [session.userId, storeId]),
      );
      if (!m) throw new AppError("forbidden");
      return { viewer: { id: session.userId }, store: { storeId, role: m.role } };
    },
  };
});
const { quickRelistAction } = await import("@/app/actions/store");

/** かんたん出品（過去の商品をもう一度出品） */

// ---------------------------------------------------------------------------
// 一覧のまとめ方・入力・受取時間の表示（DB なし）
// ---------------------------------------------------------------------------
const NOW = new Date("2026-10-24T15:00:00+09:00");
function row(over: Partial<RelistSourceRow>): RelistSourceRow {
  return {
    id: crypto.randomUUID(),
    name: "本日の食べつなぎBOX",
    imageUrl: null,
    rescuePrice: 750,
    originalPrice: 1500,
    isBox: true,
    category: "bread",
    description: "",
    quantity: 5,
    pickupStartAt: "2026-10-23T20:00:00+09:00",
    pickupEndAt: "2026-10-23T23:00:00+09:00",
    createdAt: "2026-10-23T15:00:00+09:00",
    ...over,
  };
}

describe("過去の商品の一覧（最新利用順・いつもの商品）", () => {
  it("同じ商品（商品名・BOX）は最新の1件にまとめ、最新利用順に並べる", () => {
    const old = row({ name: "パンおまかせBOX", createdAt: "2026-10-20T15:00:00+09:00", rescuePrice: 600 });
    const latest = row({ name: "パンおまかせBOX", createdAt: "2026-10-22T15:00:00+09:00", rescuePrice: 650 });
    const deli = row({ name: "本日の惣菜セット", isBox: false, createdAt: "2026-10-23T15:00:00+09:00" });
    const { recent } = groupRelistSources([old, deli, latest], NOW);
    expect(recent.map((r) => r.name)).toEqual(["本日の惣菜セット", "パンおまかせBOX"]);
    expect(recent[1]).toMatchObject({ id: latest.id, rescuePrice: 650, times: 2 });
  });

  it("いつもの商品: 直近30日に2回以上出品した商品を回数順に最大3件（古い出品は数えない）", () => {
    const rows = [
      ...["10-23", "10-22", "10-21"].map((d) => row({ name: "A", createdAt: `2026-${d}T10:00:00+09:00` })),
      ...["10-23", "10-20"].map((d) => row({ name: "B", createdAt: `2026-${d}T09:00:00+09:00` })),
      ...["10-19", "10-18"].map((d) => row({ name: "C", createdAt: `2026-${d}T09:00:00+09:00` })),
      ...["10-17", "10-16"].map((d) => row({ name: "D", createdAt: `2026-${d}T09:00:00+09:00` })),
      row({ name: "E", createdAt: "2026-10-23T08:00:00+09:00" }),
      ...["08-01", "08-02", "08-03"].map((d) => row({ name: "F", createdAt: `2026-${d}T09:00:00+09:00` })),
    ];
    const { usual } = groupRelistSources(rows, NOW);
    expect(usual.map((u) => u.name)).toEqual(["A", "B", "C"]);
  });

  it("数量・受取時間は必ず入力（空はエラー）。価格は任意（空なら前回）", () => {
    const base = { sourceId: crypto.randomUUID(), pickupDate: "2026-10-24", pickupStart: "20:00", pickupEnd: "23:00" };
    expect(quickRelistSchema.safeParse({ ...base, quantity: "" }).success).toBe(false);
    expect(quickRelistSchema.safeParse({ ...base, quantity: "0" }).success).toBe(false);
    expect(quickRelistSchema.safeParse({ ...base, quantity: "5", pickupStart: "" }).success).toBe(false);
    expect(quickRelistSchema.safeParse({ ...base, quantity: "5", pickupEnd: "20:00" }).success).toBe(false);
    const ok = quickRelistSchema.parse({ ...base, quantity: "5", rescuePrice: "", originalPrice: "" });
    expect(ok).toMatchObject({ quantity: 5, rescuePrice: null, originalPrice: null });
    expect(resolvePrices({ rescuePrice: 750, originalPrice: 1500 }, ok)).toEqual({ ok: true, rescuePrice: 750, originalPrice: 1500 });
    expect(resolvePrices({ rescuePrice: 750, originalPrice: 1500 }, { rescuePrice: 600, originalPrice: null })).toEqual({ ok: true, rescuePrice: 600, originalPrice: 1500 });
    expect(resolvePrices({ rescuePrice: 750, originalPrice: 1500 }, { rescuePrice: 1600, originalPrice: null }).ok).toBe(false);
  });

  it("受取時間の表示: 日付またぎは「翌」。前回の時刻（日付は使わない）", () => {
    expect(quickPickupLabel("2026-10-24", "20:00", "23:00", NOW)).toBe("今日 20:00〜23:00");
    expect(quickPickupLabel("2026-10-24", "23:00", "01:00", NOW)).toBe("今日 23:00〜翌1:00");
    expect(quickPickupLabel("2026-10-25", "10:00", "12:30", NOW)).toBe("明日 10:00〜12:30");
    expect(quickPickupLabel("2026-10-24", "", "23:00", NOW)).toBe("");
    expect(previousTimes({ pickupStartAt: "2026-10-23T23:00:00+09:00", pickupEndAt: "2026-10-24T01:00:00+09:00" })).toEqual({ start: "23:00", end: "01:00" });
  });
});

// ---------------------------------------------------------------------------
// 出品（DB）
// ---------------------------------------------------------------------------
let driver: Driver | undefined;
let sourceId: string;
/** 受取日（22時以降に実行したときは、23:00〜の枠が終わらないよう明日にする） */
const lateNight = () => jstHour(new Date()) >= 22;
const pickupDay = () => ymd(new Date(Date.now() + (lateNight() ? 86_400_000 : 0)));

const form = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
};
const products = () =>
  asService((q) =>
    q.query<{ id: string; name: string; image_url: string | null; description: string; category: string; is_box: boolean; rescue_price: number; original_price: number; quantity: number; remaining_quantity: number; status: string; pickup_start_at: Date; pickup_end_at: Date; store_id: string }>(
      "select * from public.products order by created_at",
    ),
  );

describe("かんたん出品（DB）", () => {
  beforeEach(async () => {
    await driver?.close();
    driver = await createTestDb();
    // 過去の商品（昨日・終了済み・残り0）
    sourceId = await createProduct(IDS.storeA, { price: 750, quantity: 3, startIn: -26 * 60, endIn: -23 * 60 });
    await asService((q) =>
      q.query(
        "update public.products set name = '本日の食べつなぎBOX', image_url = '/api/uploads/products/box.jpg', description = 'パンの詰め合わせ', remaining_quantity = 0 where id = $1",
        [sourceId],
      ),
    );
    session.userId = IDS.ownerA;
  });
  afterAll(async () => {
    await driver?.close();
  });

  it("過去の商品一覧は自店舗の商品だけ", async () => {
    await createProduct(IDS.storeB, { price: 500 });
    const { recent } = await listRelistSources(IDS.ownerA, IDS.storeA);
    expect(recent.map((r) => r.id)).toEqual([sourceId]);
    expect(await getRelistSource(IDS.ownerA, IDS.storeA, sourceId)).toMatchObject({ name: "本日の食べつなぎBOX", rescuePrice: 750, originalPrice: 1500 });
  });

  it("商品名・画像・価格・参考価格・説明・BOX・カテゴリーを引き継ぎ、数量と受取時間は今回の入力で新しい商品として出品する", async () => {
    const today = pickupDay();
    const res = await quickRelistAction(null, form({ storeId: IDS.storeA, sourceId, quantity: "5", pickupDate: today, pickupStart: "23:00", pickupEnd: "23:30" }));
    expect(res).toMatchObject({ ok: true, message: "出品しました！" });
    const newId = String(res?.data?.productId);
    expect(newId).not.toBe(sourceId);
    const [src, created] = await products();
    expect(created).toMatchObject({
      id: newId,
      store_id: IDS.storeA,
      name: "本日の食べつなぎBOX",
      image_url: "/api/uploads/products/box.jpg",
      description: "パンの詰め合わせ",
      category: "bread",
      is_box: true,
      rescue_price: 750,
      original_price: 1500,
      quantity: 5,
      remaining_quantity: 5,
      status: "published",
    });
    expect(new Date(created.pickup_start_at).toISOString()).toBe(new Date(`${today}T23:00:00+09:00`).toISOString());
    // 過去の商品は変更しない（在庫・日時・状態）
    expect(src).toMatchObject({ id: sourceId, quantity: 3, remaining_quantity: 0 });
    // ダッシュボードの本日の出品に「公開中・残り5・受取時間」で出る
    if (!lateNight()) {
      const d = await getStoreDashboard(IDS.ownerA, IDS.storeA);
      expect(d.todayProducts.find((p) => p.id === newId)).toMatchObject({ remaining: 5, quantity: 5, status: "published" });
    }
  });

  it("数量・受取時間がなければ出品しない（過去の値を使わない）", async () => {
    const today = pickupDay();
    expect(await quickRelistAction(null, form({ storeId: IDS.storeA, sourceId, quantity: "", pickupDate: today, pickupStart: "23:00", pickupEnd: "23:30" }))).toMatchObject({
      ok: false,
      fieldErrors: { quantity: expect.any(String) },
    });
    expect(await quickRelistAction(null, form({ storeId: IDS.storeA, sourceId, quantity: "5", pickupDate: today, pickupStart: "", pickupEnd: "" }))).toMatchObject({ ok: false });
    expect(await products()).toHaveLength(1);
  });

  it("価格は変更できる（既定は前回）。販売価格が参考価格より高いと出品しない", async () => {
    const today = pickupDay();
    const base = { storeId: IDS.storeA, sourceId, quantity: "4", pickupDate: today, pickupStart: "23:00", pickupEnd: "23:45" };
    expect(await quickRelistAction(null, form({ ...base, rescuePrice: "600", originalPrice: "" }))).toMatchObject({ ok: true });
    expect(await quickRelistAction(null, form({ ...base, rescuePrice: "2000", originalPrice: "" }))).toMatchObject({ ok: false });
    expect((await products()).map((p) => p.rescue_price)).toEqual([750, 600]);
  });

  it("日付またぎ（23:00〜翌1:00）は実日時で保存する", async () => {
    const today = pickupDay();
    const id = await quickRelist(IDS.ownerA, IDS.storeA, { sourceId, quantity: 2, pickupDate: today, pickupStart: "23:00", pickupEnd: "01:00", rescuePrice: null, originalPrice: null });
    const p = (await products()).find((x) => x.id === id)!;
    expect(new Date(p.pickup_start_at).toISOString()).toBe(new Date(`${today}T23:00:00+09:00`).toISOString());
    expect(new Date(p.pickup_end_at).getTime() - new Date(p.pickup_start_at).getTime()).toBe(2 * 60 * 60_000);
  });

  it("スタッフも出品できる。他店舗の商品は複製できない・他店舗には出品できない", async () => {
    const today = pickupDay();
    const base = { quantity: "3", pickupDate: today, pickupStart: "23:00", pickupEnd: "23:30" };
    session.userId = IDS.staffA;
    expect(await quickRelistAction(null, form({ ...base, storeId: IDS.storeA, sourceId }))).toMatchObject({ ok: true });
    // 店舗Bのスタッフ: 店舗Aの商品を自店舗（B）へ複製しようとしても見つからない
    session.userId = IDS.staffB;
    expect(await quickRelistAction(null, form({ ...base, storeId: IDS.storeB, sourceId }))).toMatchObject({ ok: false, code: "product_not_found" });
    // 店舗Aとして出品しようとしても、メンバーではないので拒否
    expect(await quickRelistAction(null, form({ ...base, storeId: IDS.storeA, sourceId }))).toMatchObject({ ok: false, code: "forbidden" });
    // 一般ユーザーも不可
    session.userId = IDS.userA;
    expect(await quickRelistAction(null, form({ ...base, storeId: IDS.storeA, sourceId }))).toMatchObject({ ok: false, code: "forbidden" });
    expect(await getRelistSource(IDS.staffB, IDS.storeB, sourceId)).toBeNull();
    expect((await products()).filter((p) => p.store_id === IDS.storeB)).toHaveLength(0);
  });

  it("ダッシュボードの「昨日と同じ商品を出品」: 直近の商品の受取日が昨日なら true", async () => {
    const d = await getStoreDashboard(IDS.ownerA, IDS.storeA);
    expect(d.lastProduct).toMatchObject({ id: sourceId, yesterday: ymd(new Date(Date.now() - 26 * 60 * 60_000)) === ymd(new Date(Date.now() - 86_400_000)) });
  });
});
