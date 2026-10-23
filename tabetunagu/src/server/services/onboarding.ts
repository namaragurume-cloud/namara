import "server-only";
import { AppError } from "@/lib/errors";
import { onboardingProgress, onboardingSteps, type OnboardingInput } from "@/lib/onboarding";
import { asService, asUser } from "../db";

/**
 * 店舗の「TABETUNAGU を始める準備」。完了フラグは持たず、店舗の実際の状態から毎回計算する（lib/readiness と同じ判定）。
 * 自店舗のメンバーだけ（RLS で確認してから、モニターの利用記録などを1クエリで読む）。Stripe のアカウント ID などは返さない。
 */
export async function getStoreOnboarding(userId: string, storeId: string, isOwner: boolean, now = new Date()) {
  const [member] = await asUser(userId, (q) => q.query<{ ok: boolean }>("select public.is_store_member($1::uuid) as ok", [storeId]));
  if (!member?.ok) throw new AppError("forbidden");
  const [r] = await asService((q) =>
    q.query<{
      active: boolean;
      address: string;
      phone: string;
      opening_hours: string;
      pickup_note: string;
      connected: boolean;
      payout_ready: boolean;
      products: number;
      published: number;
      monitor: boolean;
    }>(
      `select s.status = 'active' as active, s.address, s.phone, s.opening_hours, coalesce(s.pickup_note, '') as pickup_note,
              s.stripe_account_id is not null as connected,
              (s.stripe_charges_enabled and s.stripe_details_submitted) as payout_ready,
              (select count(*) from public.products p where p.store_id = s.id and p.deleted_at is null)::int as products,
              (select count(*) from public.products p where p.store_id = s.id and p.deleted_at is null
                 and p.status = 'published' and p.pickup_end_at > $2::timestamptz)::int as published,
              exists (select 1 from public.events e where e.store_id = s.id and e.name = 'monitor_opened'
                        and e.created_at > $2::timestamptz - interval '30 days') as monitor
       from public.stores s where s.id = $1`,
      [storeId, now.toISOString()],
    ),
  );
  if (!r) throw new AppError("forbidden");
  const missingInfo: OnboardingInput["missingInfo"] = [];
  if (!r.address?.trim()) missingInfo.push("住所");
  if (!r.phone?.trim()) missingInfo.push("電話番号");
  if (!r.opening_hours?.trim()) missingInfo.push("営業時間");
  const input: OnboardingInput = {
    storeActive: r.active,
    missingInfo,
    pickupNote: r.pickup_note,
    payout: r.payout_ready ? "done" : r.connected ? "in_progress" : "not_started",
    productCount: Number(r.products),
    publishedCount: Number(r.published),
    monitorOpened: r.monitor,
    isOwner,
  };
  const steps = onboardingSteps(input);
  return { steps, progress: onboardingProgress(steps) };
}

export type StoreOnboarding = Awaited<ReturnType<typeof getStoreOnboarding>>;
