import "server-only";
import { AppError } from "@/lib/errors";
import { asService, asUser } from "../db";
import { env } from "../env";
import { getStripe } from "../stripe/client";

/**
 * 店舗の売上受取設定（Stripe Connect Express）。
 * - 開始・再開はオーナーのみ。状態の確認は店舗メンバー。
 * - 接続アカウントの状態は account.updated Webhook と、店舗画面に戻ったときの再取得で同期する。
 */

export type StorePaymentStatus = {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingCompletedAt: string | null;
  syncedAt: string | null;
};

export async function getStorePaymentStatus(userId: string, storeId: string): Promise<StorePaymentStatus> {
  const [row] = await asUser(userId, (q) =>
    q.query<{
      stripe_account_id: string | null;
      charges_enabled: boolean;
      payouts_enabled: boolean;
      details_submitted: boolean;
      onboarding_completed_at: Date | null;
      synced_at: Date | null;
    }>("select * from public.store_payment_status($1::uuid)", [storeId]),
  );
  return {
    connected: Boolean(row?.stripe_account_id),
    chargesEnabled: Boolean(row?.charges_enabled),
    payoutsEnabled: Boolean(row?.payouts_enabled),
    detailsSubmitted: Boolean(row?.details_submitted),
    onboardingCompletedAt: row?.onboarding_completed_at ? new Date(row.onboarding_completed_at).toISOString() : null,
    syncedAt: row?.synced_at ? new Date(row.synced_at).toISOString() : null,
  };
}

async function storeForMember(userId: string, storeId: string, opts: { owner: boolean }) {
  const [row] = await asService((q) =>
    q.query<{ role: "owner" | "staff"; name: string; stripe_account_id: string | null }>(
      `select m.role, s.name, s.stripe_account_id
       from public.store_members m join public.stores s on s.id = m.store_id
       where m.store_id = $1 and m.user_id = $2`,
      [storeId, userId],
    ),
  );
  if (!row || (opts.owner && row.role !== "owner")) throw new AppError("forbidden");
  return row;
}

/**
 * 売上受取設定を開始・再開する（オーナーのみ）。接続アカウントがなければ作成し、Stripe の登録画面の URL を返す。
 */
export async function startConnectOnboarding(userId: string, storeId: string): Promise<string> {
  const stripe = getStripe();
  const store = await storeForMember(userId, storeId, { owner: true });
  let accountId = store.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create(
      {
        type: "express",
        country: "JP",
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_profile: { name: store.name },
        metadata: { store_id: storeId },
      },
      { idempotencyKey: `tt_connect_account_${storeId}` },
    );
    await asService((q) => q.query("select public.set_store_stripe_account($1::uuid, $2)", [storeId, account.id]));
    accountId = account.id;
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${env.appUrl}/store/payouts/refresh`,
    return_url: `${env.appUrl}/store/payouts?from=stripe`,
  });
  return link.url;
}

/** Stripe から接続アカウントの状態を取り直して保存する（店舗メンバー） */
export async function refreshConnectStatus(userId: string, storeId: string) {
  const store = await storeForMember(userId, storeId, { owner: false });
  if (!store.stripe_account_id) return getStorePaymentStatus(userId, storeId);
  const account = await getStripe().accounts.retrieve(store.stripe_account_id);
  await asService((q) =>
    q.query("select public.sync_stripe_account($1, $2, $3, $4)", [
      account.id,
      Boolean(account.charges_enabled),
      Boolean(account.payouts_enabled),
      Boolean(account.details_submitted),
    ]),
  );
  return getStorePaymentStatus(userId, storeId);
}
