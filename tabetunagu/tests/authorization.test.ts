import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { productFormSchema } from "@/lib/validation";
import { asAnon, asService, asUser } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { createReservation } from "@/server/services/reservations";
import { createProduct as createProductAsStore, listStoreReservations } from "@/server/services/store";
import { ymd } from "@/lib/format";
import { createProduct, createTestDb, getProduct, IDS } from "./support/db";

let driver: Driver | undefined;

beforeEach(async () => {
  await driver?.close();
  driver = await createTestDb();
});

afterAll(async () => {
  await driver?.close();
});

const validForm = () =>
  productFormSchema.parse({
    name: "本日の食べつなぎBOX",
    category: "bread",
    isBox: "on",
    originalPrice: "1500",
    rescuePrice: "800",
    quantity: "5",
    pickupDate: ymd(),
    pickupStart: "00:00",
    pickupEnd: "23:59",
  });

describe("RLS: 店舗間のデータ分離", () => {
  it("店舗Aのスタッフは店舗Bの予約を閲覧できない", async () => {
    await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    await createReservation(IDS.userB, await createProduct(IDS.storeB), 1);

    const seenByA = await asUser(IDS.staffA, (q) => q.query<{ store_id: string }>("select store_id from public.reservations"));
    expect(seenByA).toHaveLength(1);
    expect(seenByA.every((r) => r.store_id === IDS.storeA)).toBe(true);

    // サービス関数経由でも店舗Bの予約は見えない（store_id を偽っても RLS で空になる）
    const viaService = await listStoreReservations(IDS.staffA, IDS.storeB, ymd());
    expect(viaService.rows).toHaveLength(0);
  });

  it("店舗Aのスタッフは店舗Bの商品を出品・更新・削除できない", async () => {
    await expect(createProductAsStore(IDS.staffA, IDS.storeB, validForm())).rejects.toThrow();
    const productB = await createProduct(IDS.storeB);
    const updated = await asUser(IDS.staffA, (q) =>
      q.query("update public.products set name = '乗っ取り' where id = $1 returning id", [productB]),
    );
    expect(updated).toHaveLength(0);
    await expect(asUser(IDS.staffA, (q) => q.query("select public.delete_product($1)", [productB]))).rejects.toBeInstanceOf(AppError);
    await expect(
      asUser(IDS.staffA, (q) => q.query("select public.adjust_product_quantity($1, 10)", [productB])),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("店舗スタッフは自店舗の商品を出品できる（残数は数量で初期化される）", async () => {
    const id = await createProductAsStore(IDS.staffA, IDS.storeA, validForm());
    const p = await getProduct(id);
    expect(p.quantity).toBe(5);
    expect(p.remaining_quantity).toBe(5);
  });

  it("店舗スタッフは在庫を直接書き換えられない（列権限）", async () => {
    const productA = await createProduct(IDS.storeA);
    await expect(
      asUser(IDS.staffA, (q) => q.query("update public.products set remaining_quantity = 99 where id = $1", [productA])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(IDS.staffA, (q) => q.query("update public.products set status = 'sold_out' where id = $1", [productA])),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("スタッフはプラン変更・QR再発行ができない（オーナーのみ）", async () => {
    await expect(asUser(IDS.staffA, (q) => q.query("select public.change_store_plan($1, 'standard')", [IDS.storeA]))).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(asUser(IDS.staffA, (q) => q.query("select public.rotate_store_qr($1)", [IDS.storeA]))).rejects.toBeInstanceOf(AppError);
    await asUser(IDS.ownerA, (q) => q.query("select public.change_store_plan($1, 'standard')", [IDS.storeA]));
    const [store] = await asService((q) => q.query<{ plan_code: string }>("select plan_code from public.stores where id = $1", [IDS.storeA]));
    expect(store.plan_code).toBe("standard");
  });

  it("店舗はステータスやプランを直接更新できない", async () => {
    await expect(
      asUser(IDS.ownerA, (q) => q.query("update public.stores set status = 'active', plan_code = 'standard' where id = $1", [IDS.storeA])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("RLS: ユーザー", () => {
  it("ユーザーは他人の予約・ポイントを閲覧できない", async () => {
    await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    const seen = await asUser(IDS.userB, (q) => q.query("select id from public.reservations"));
    expect(seen).toHaveLength(0);
    const stats = await asUser(IDS.userB, (q) => q.query("select user_id from public.user_stats"));
    expect(stats.every((s) => (s as { user_id: string }).user_id === IDS.userB)).toBe(true);
  });

  it("ユーザーは他人のメールアドレスなどを読めない（列権限）", async () => {
    await expect(asUser(IDS.userA, (q) => q.query("select email from public.users"))).rejects.toThrow(/permission denied/);
    const [me] = await asUser(IDS.userA, (q) => q.query<{ id: string }>("select id from public.my_profile()"));
    expect(me.id).toBe(IDS.userA);
  });

  it("ユーザーは他人のお気に入りを追加できない", async () => {
    await expect(
      asUser(IDS.userA, (q) => q.query("insert into public.favorites (user_id, store_id) values ($1, $2)", [IDS.userB, IDS.storeA])),
    ).rejects.toThrow();
  });

  it("未ログイン（anon）は公開中の商品と稼働店舗だけ閲覧でき、予約・イベントは見えない", async () => {
    await createProduct(IDS.storeA);
    await createProduct(IDS.storeSuspended);
    await createProduct(IDS.storeA, { status: "draft" });
    const products = await asAnon((q) => q.query<{ store_id: string; status: string }>("select store_id, status::text from public.products"));
    expect(products).toHaveLength(1);
    expect(products[0].store_id).toBe(IDS.storeA);
    await expect(asAnon((q) => q.query("select * from public.reservations"))).rejects.toThrow(/permission denied/);
    await expect(asAnon((q) => q.query("select * from public.events"))).rejects.toThrow(/permission denied/);
    await expect(asAnon((q) => q.query("select public.reserve_product(gen_random_uuid(), 1)"))).rejects.toThrow(/permission denied/);
  });

  it("一般ユーザーは管理者用テーブル・バッチ関数にアクセスできない", async () => {
    await expect(asUser(IDS.userA, (q) => q.query("select * from public.admin_users"))).rejects.toThrow(/permission denied/);
    await expect(asUser(IDS.userA, (q) => q.query("select public.sweep_reservations()"))).rejects.toThrow(/permission denied/);
    await expect(asUser(IDS.admin, (q) => q.query("select * from public.notifications"))).rejects.toThrow(/permission denied/);
  });
});
