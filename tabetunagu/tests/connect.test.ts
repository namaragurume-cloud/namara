import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { asAnon, asService, asUser } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { getStorePaymentStatus, refreshConnectStatus, startConnectOnboarding } from "@/server/services/connect";
import { createTestDb, IDS } from "./support/db";
import { connectStore, installFakeStripe, uninstallFakeStripe, type FakeStripe } from "./support/stripe";

let driver: Driver | undefined;
let fake: FakeStripe;

beforeEach(async () => {
  await driver?.close();
  driver = await createTestDb();
  fake = installFakeStripe();
});

afterEach(() => uninstallFakeStripe());

afterAll(async () => {
  await driver?.close();
});

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((e: AppError) => expect(e.code).toBe(code));
}

const storeAccount = async (storeId: string) =>
  (await asService((q) => q.query<{ stripe_account_id: string | null }>("select stripe_account_id from public.stores where id = $1", [storeId])))[0]
    .stripe_account_id;

describe("売上受取設定（Stripe Connect Express）", () => {
  it("オーナーが開始すると接続アカウントを作成し、登録画面の URL を返す。2回目は同じアカウントを使う", async () => {
    const url = await startConnectOnboarding(IDS.ownerA, IDS.storeA);
    expect(url).toMatch(/^https:\/\/connect\.stripe\.com\//);
    const accountId = await storeAccount(IDS.storeA);
    expect(accountId).toMatch(/^acct_/);
    const createCall = (fake.stripe.accounts.create as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(createCall[0]).toMatchObject({ type: "express", country: "JP", metadata: { store_id: IDS.storeA } });
    expect(createCall[1]).toEqual({ idempotencyKey: `tt_connect_account_${IDS.storeA}` });
    const linkCall = (fake.stripe.accountLinks.create as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0];
    expect(linkCall).toMatchObject({
      account: accountId,
      type: "account_onboarding",
      refresh_url: "http://localhost:3000/store/payouts/refresh",
      return_url: "http://localhost:3000/store/payouts?from=stripe",
    });

    await startConnectOnboarding(IDS.ownerA, IDS.storeA);
    expect(fake.stripe.accounts.create).toHaveBeenCalledTimes(1);
    expect(await storeAccount(IDS.storeA)).toBe(accountId);
  });

  it("スタッフ・他店舗のメンバー・一般ユーザーは開始できない", async () => {
    await expectAppError(startConnectOnboarding(IDS.staffA, IDS.storeA), "forbidden");
    await expectAppError(startConnectOnboarding(IDS.staffB, IDS.storeA), "forbidden");
    await expectAppError(startConnectOnboarding(IDS.userA, IDS.storeA), "forbidden");
    expect(fake.stripe.accounts.create).not.toHaveBeenCalled();
  });

  it("店舗画面に戻ったら Stripe から状態を取り直して保存する", async () => {
    await startConnectOnboarding(IDS.ownerA, IDS.storeA);
    const accountId = (await storeAccount(IDS.storeA))!;
    expect((await getStorePaymentStatus(IDS.staffA, IDS.storeA)).chargesEnabled).toBe(false);
    fake.accounts.set(accountId, { id: accountId, charges_enabled: true, payouts_enabled: true, details_submitted: true } as never);
    const status = await refreshConnectStatus(IDS.staffA, IDS.storeA);
    expect(status).toMatchObject({ connected: true, chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true });
    expect(status.onboardingCompletedAt).not.toBeNull();
  });

  it("他店舗の Connect 情報は見られない・操作できない", async () => {
    await connectStore(IDS.storeB, "acct_storeB");
    await expectAppError(getStorePaymentStatus(IDS.staffA, IDS.storeB), "forbidden");
    await expectAppError(refreshConnectStatus(IDS.staffA, IDS.storeB), "forbidden");
    // 列権限: アカウント ID は店舗メンバーにも一般ユーザーにも直接は読めない（決済可否のみ公開）
    for (const user of [IDS.staffA, IDS.staffB, IDS.userA]) {
      await expect(
        asUser(user, (q) => q.query("select stripe_account_id from public.stores where id = $1", [IDS.storeB])),
      ).rejects.toThrow(/permission denied/);
    }
    await expect(asAnon((q) => q.query("select stripe_payouts_enabled from public.stores"))).rejects.toThrow(/permission denied/);
    const [row] = await asAnon((q) =>
      q.query<{ stripe_charges_enabled: boolean }>("select stripe_charges_enabled from public.stores where id = $1", [IDS.storeB]),
    );
    expect(row.stripe_charges_enabled).toBe(true);
    // 店舗は Connect の状態を直接書き換えられない
    await expect(
      asUser(IDS.ownerA, (q) => q.query("update public.stores set stripe_charges_enabled = true where id = $1", [IDS.storeA])),
    ).rejects.toThrow(/permission denied/);
  });

  it("店舗の接続アカウントは別のアカウントに付け替えられない", async () => {
    await connectStore(IDS.storeA, "acct_storeA");
    await expectAppError(
      asService((q) => q.query("select public.set_store_stripe_account($1::uuid, 'acct_other')", [IDS.storeA])),
      "stripe_account_exists",
    );
    // 同じアカウント ID を別の店舗に使うこともできない（UNIQUE）
    await expect(connectStore(IDS.storeB, "acct_storeA")).rejects.toThrow();
  });

  it("Stripe が未設定なら開始できない", async () => {
    uninstallFakeStripe();
    await expectAppError(startConnectOnboarding(IDS.ownerA, IDS.storeA), "payment_unavailable");
  });
});
