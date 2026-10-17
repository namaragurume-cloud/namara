import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asService, asUser } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { createStoreQrToken, extractQrToken, storeQrUrl, verifyStoreQrToken } from "@/server/qr";
import { checkinWithToken } from "@/server/services/checkin";
import { cancelReservation, createReservation, getMyStats } from "@/server/services/reservations";
import { createProduct, createTestDb, getReservation, IDS, shiftReservationWindow } from "./support/db";

let driver: Driver | undefined;

beforeEach(async () => {
  await driver?.close();
  driver = await createTestDb();
});

afterAll(async () => {
  await driver?.close();
});

const tokenA = () => createStoreQrToken(IDS.storeA, 1);
const tokenB = () => createStoreQrToken(IDS.storeB, 1);

describe("QR トークン", () => {
  it("署名を検証し、改ざんを検出する", () => {
    const token = tokenA();
    expect(verifyStoreQrToken(token)).toEqual({ storeId: IDS.storeA, version: 1 });
    // 店舗IDの書き換え
    const forged = token.replace(IDS.storeA.replace(/-/g, ""), IDS.storeB.replace(/-/g, ""));
    expect(verifyStoreQrToken(forged)).toBeNull();
    // バージョンの書き換え
    expect(verifyStoreQrToken(token.replace(".1.", ".2."))).toBeNull();
    expect(verifyStoreQrToken("v1.garbage")).toBeNull();
    expect(verifyStoreQrToken("")).toBeNull();
  });

  it("QR の URL からトークンを取り出せる", () => {
    const token = tokenA();
    expect(extractQrToken(storeQrUrl(token))).toBe(token);
    expect(extractQrToken(`https://liff.line.me/12345-abc/c/${token}`)).toBe(token);
    expect(extractQrToken("https://example.com/other")).toBeNull();
  });
});

describe("QR チェックイン", () => {
  it("有効な予約があれば completed になり、成約時のプラン・手数料率とポイントが記録される", async () => {
    const res = await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    const result = await checkinWithToken(IDS.userA, tokenA());
    expect(result.result).toBe("success");
    if (result.result !== "success") return;
    expect(result.reservationIds).toEqual([res.id]);
    expect(result.pointsAwarded).toBe(10);

    const r = await getReservation(res.id);
    expect(r.status).toBe("completed");
    expect(r.completed_at).not.toBeNull();
    expect(r.plan_code).toBe("free");
    expect(r.commission_rate).toBeCloseTo(0.15);

    const stats = await getMyStats(IDS.userA);
    expect(stats.completedCount).toBe(1);
    expect(stats.points).toBe(10);
    expect(stats.foodSavedG).toBeGreaterThan(0);
  });

  it("同じ予約で2回QRを読んでも二重に完了・ポイント付与されない", async () => {
    await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    expect((await checkinWithToken(IDS.userA, tokenA())).result).toBe("success");
    const second = await checkinWithToken(IDS.userA, tokenA());
    expect(second.result).toBe("already_completed");
    expect((await getMyStats(IDS.userA)).points).toBe(10);
    const [{ count }] = await asService((q) =>
      q.query<{ count: number }>("select count(*)::int as count from public.checkins where result = 'success'"),
    );
    expect(count).toBe(1);
  });

  it("同時に2回チェックインしても完了は1回だけ", async () => {
    await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    const results = await Promise.all([checkinWithToken(IDS.userA, tokenA()), checkinWithToken(IDS.userA, tokenA())]);
    expect(results.filter((r) => r.result === "success")).toHaveLength(1);
    expect((await getMyStats(IDS.userA)).points).toBe(10);
  });

  it("別店舗のQRでは完了できない", async () => {
    const res = await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    const result = await checkinWithToken(IDS.userA, tokenB());
    expect(result.result).toBe("no_reservation");
    expect((await getReservation(res.id)).status).toBe("confirmed");
  });

  it("改ざんされたQRでは完了できず、失敗が記録される", async () => {
    const res = await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    const forged = tokenA().slice(0, -2) + "xx";
    expect((await checkinWithToken(IDS.userA, forged)).result).toBe("invalid_token");
    expect((await getReservation(res.id)).status).toBe("confirmed");
    const [{ count }] = await asService((q) =>
      q.query<{ count: number }>("select count(*)::int as count from public.checkins where result = 'invalid_token'"),
    );
    expect(count).toBe(1);
  });

  it("再発行で古くなったQR（qr_version 不一致）では完了できない", async () => {
    await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    await asUser(IDS.ownerA, (q) => q.query("select public.rotate_store_qr($1)", [IDS.storeA]));
    expect((await checkinWithToken(IDS.userA, tokenA())).result).toBe("invalid_token");
    expect((await checkinWithToken(IDS.userA, createStoreQrToken(IDS.storeA, 2))).result).toBe("success");
  });

  it("受取時間終了後（猶予超過）のQRは window_closed", async () => {
    const res = await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    await shiftReservationWindow(res.id, -180, -45);
    expect((await checkinWithToken(IDS.userA, tokenA())).result).toBe("window_closed");
    expect((await getReservation(res.id)).status).toBe("confirmed");
  });

  it("受取終了直後でも猶予時間内なら完了できる", async () => {
    const res = await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    await shiftReservationWindow(res.id, -120, -10);
    expect((await checkinWithToken(IDS.userA, tokenA())).result).toBe("success");
  });

  it("受取開始より大幅に早いQRは too_early", async () => {
    const res = await createReservation(IDS.userA, await createProduct(IDS.storeA, { startIn: 120, endIn: 240 }), 1);
    const result = await checkinWithToken(IDS.userA, tokenA());
    expect(result.result).toBe("too_early");
    expect((await getReservation(res.id)).status).toBe("confirmed");
  });

  it("キャンセル後のQRでは完了できない", async () => {
    const res = await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    await cancelReservation(IDS.userA, res.id);
    expect((await checkinWithToken(IDS.userA, tokenA())).result).toBe("cancelled");
    expect((await getReservation(res.id)).status).toBe("cancelled");
  });

  it("他人の予約は自分のチェックインで完了しない", async () => {
    const res = await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    expect((await checkinWithToken(IDS.userB, tokenA())).result).toBe("no_reservation");
    expect((await getReservation(res.id)).status).toBe("confirmed");
  });

  it("停止中の店舗のQRでは完了できない", async () => {
    const res = await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    await asService((q) => q.query("update public.stores set status = 'suspended' where id = $1", [IDS.storeA]));
    expect((await checkinWithToken(IDS.userA, tokenA())).result).toBe("store_inactive");
    expect((await getReservation(res.id)).status).toBe("confirmed");
  });

  it("同じ店舗の有効な予約が複数あれば、1回のQRでまとめて完了する", async () => {
    await createReservation(IDS.userA, await createProduct(IDS.storeA), 1);
    await createReservation(IDS.userA, await createProduct(IDS.storeA), 2);
    const result = await checkinWithToken(IDS.userA, tokenA());
    expect(result.result).toBe("success");
    if (result.result === "success") expect(result.reservationIds).toHaveLength(2);
    expect((await getMyStats(IDS.userA)).points).toBe(20);
  });

  it("STANDARD 店舗の成約は手数料率 5% で記録される", async () => {
    const res = await createReservation(IDS.userA, await createProduct(IDS.storeB), 1);
    expect((await checkinWithToken(IDS.userA, tokenB())).result).toBe("success");
    const r = await getReservation(res.id);
    expect(r.plan_code).toBe("standard");
    expect(r.commission_rate).toBeCloseTo(0.05);
  });
});
