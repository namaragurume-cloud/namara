import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { asService, asUser } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { cancelReservation, createReservation, getMyStats } from "@/server/services/reservations";
import { createProduct, createTestDb, getProduct, IDS } from "./support/db";

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

describe("予約作成", () => {
  it("予約すると残数が減り、予約番号が発行される", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 3 });
    const res = await createReservation(IDS.userA, productId, 2);
    expect(res.code).toMatch(/^[2-9A-Z]{6}$/);
    const p = await getProduct(productId);
    expect(p.remaining_quantity).toBe(1);
    expect(p.status).toBe("published");

    const stats = await getMyStats(IDS.userA);
    expect(stats.reservationCount).toBe(1);
  });

  it("最後の1個を予約すると sold_out になり、次の予約は売り切れになる", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 1 });
    await createReservation(IDS.userA, productId, 1);
    expect((await getProduct(productId)).status).toBe("sold_out");
    await expectAppError(createReservation(IDS.userB, productId, 1), "sold_out");
    expect((await getProduct(productId)).remaining_quantity).toBe(0);
  });

  it("同時に最後の1個を2人が予約しても、成功するのは1人だけ", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 1 });
    const results = await Promise.allSettled([
      createReservation(IDS.userA, productId, 1),
      createReservation(IDS.userB, productId, 1),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((rejected.reason as AppError).code).toBe("sold_out");
    expect((await getProduct(productId)).remaining_quantity).toBe(0);
  });

  it("残数を超える数量は予約できない（数量は減らない）", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 5, maxPer: 3 });
    await expectAppError(createReservation(IDS.userA, productId, 4), "quantity_limit");
    const productId2 = await createProduct(IDS.storeA, { quantity: 2, maxPer: 5 });
    await expectAppError(createReservation(IDS.userA, productId2, 3), "insufficient_stock");
    expect((await getProduct(productId2)).remaining_quantity).toBe(2);
  });

  it("同じ商品を重複して予約できない", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 5 });
    await createReservation(IDS.userA, productId, 1);
    await expectAppError(createReservation(IDS.userA, productId, 1), "already_reserved");
  });

  it("同時に持てる有効な予約は3件まで", async () => {
    for (let i = 0; i < 3; i++) {
      await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    }
    await expectAppError(createReservation(IDS.userA, await createProduct(IDS.storeA), 1), "too_many_active");
  });

  it("停止店舗の商品は予約できない", async () => {
    const productId = await createProduct(IDS.storeSuspended);
    await expectAppError(createReservation(IDS.userA, productId, 1), "store_inactive");
  });

  it("数量0の商品は予約できない", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 1 });
    await asService((q) => q.query("update public.products set remaining_quantity = 0 where id = $1", [productId]));
    await expectAppError(createReservation(IDS.userA, productId, 1), "sold_out");
  });

  it("削除済みの商品は予約できない", async () => {
    const productId = await createProduct(IDS.storeA);
    await asUser(IDS.staffA, (q) => q.query("select public.delete_product($1)", [productId]));
    await expectAppError(createReservation(IDS.userA, productId, 1), "product_not_found");
  });

  it("受取時間が終わった商品・出品停止中の商品は予約できない", async () => {
    const ended = await createProduct(IDS.storeA, { startIn: -120, endIn: -1 });
    await expectAppError(createReservation(IDS.userA, ended, 1), "pickup_ended");
    const closed = await createProduct(IDS.storeA, { status: "closed" });
    await expectAppError(createReservation(IDS.userA, closed, 1), "not_available");
  });

  it("存在しないユーザー（未ログイン相当）は予約できない", async () => {
    const productId = await createProduct(IDS.storeA);
    await expectAppError(createReservation("99999999-0000-4000-8000-000000000000", productId, 1), "not_authenticated");
  });
});

describe("キャンセル", () => {
  it("キャンセルすると残数が戻り、sold_out も published に戻る", async () => {
    const productId = await createProduct(IDS.storeA, { quantity: 1 });
    const res = await createReservation(IDS.userA, productId, 1);
    expect((await getProduct(productId)).status).toBe("sold_out");
    await cancelReservation(IDS.userA, res.id);
    const p = await getProduct(productId);
    expect(p.remaining_quantity).toBe(1);
    expect(p.status).toBe("published");
    expect((await getMyStats(IDS.userA)).cancelledCount).toBe(1);
    // キャンセル後は再予約できる
    await createReservation(IDS.userB, productId, 1);
  });

  it("二重キャンセル・他人の予約のキャンセルはできない", async () => {
    const productId = await createProduct(IDS.storeA);
    const res = await createReservation(IDS.userA, productId, 1);
    await expectAppError(cancelReservation(IDS.userB, res.id), "reservation_not_found");
    await cancelReservation(IDS.userA, res.id);
    await expectAppError(cancelReservation(IDS.userA, res.id), "not_cancellable");
    expect((await getProduct(productId)).remaining_quantity).toBe(3);
  });

  it("店舗都合のキャンセルは自店舗の予約のみ・理由必須", async () => {
    const productId = await createProduct(IDS.storeA);
    const res = await createReservation(IDS.userA, productId, 1);
    await expectAppError(
      asUser(IDS.staffB, (q) => q.query("select public.store_cancel_reservation($1, 'x')", [res.id])),
      "reservation_not_found",
    );
    await expectAppError(
      asUser(IDS.staffA, (q) => q.query("select public.store_cancel_reservation($1, '')", [res.id])),
      "reason_required",
    );
    await asUser(IDS.staffA, (q) => q.query("select public.store_cancel_reservation($1, '品切れのため')", [res.id]));
    // 店舗都合のキャンセルはユーザーの集計に含めない
    expect((await getMyStats(IDS.userA)).cancelledCount).toBe(0);
  });
});

describe("No Show", () => {
  it("受取時間 + 猶予を過ぎた予約は no_show になり、信頼スコアが下がる", async () => {
    const productId = await createProduct(IDS.storeA);
    const res = await createReservation(IDS.userA, productId, 1);
    await asService((q) =>
      q.query(
        "update public.reservations set pickup_start_at = now() - interval '3 hours', pickup_end_at = now() - interval '2 hours' where id = $1",
        [res.id],
      ),
    );
    const [{ data }] = await asService((q) => q.query<{ data: { no_show: number } }>("select public.sweep_reservations() as data"));
    expect(data.no_show).toBe(1);
    const stats = await getMyStats(IDS.userA);
    expect(stats.noShowCount).toBe(1);
    expect(stats.trustScore).toBe(80);
  });

  it("猶予時間内の予約は no_show にしない", async () => {
    const productId = await createProduct(IDS.storeA);
    const res = await createReservation(IDS.userA, productId, 1);
    await asService((q) =>
      q.query(
        "update public.reservations set pickup_start_at = now() - interval '2 hours', pickup_end_at = now() - interval '10 minutes' where id = $1",
        [res.id],
      ),
    );
    const [{ data }] = await asService((q) => q.query<{ data: { no_show: number } }>("select public.sweep_reservations() as data"));
    expect(data.no_show).toBe(0);
  });
});
