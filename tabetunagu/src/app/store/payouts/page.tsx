import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { ConnectOnboardingForm } from "@/components/store/ConnectOnboardingForm";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Section";
import { dateTime } from "@/lib/format";
import { requireStoreMember } from "@/server/auth/viewer";
import { env } from "@/server/env";
import { getStorePaymentStatus, refreshConnectStatus, type StorePaymentStatus } from "@/server/services/connect";

export const metadata: Metadata = { title: "売上受取設定" };

export default async function StorePayoutsPage({ searchParams }: { searchParams: Promise<{ from?: string; error?: string }> }) {
  const { from, error } = await searchParams;
  const { viewer, store } = await requireStoreMember("/store/payouts");
  let status: StorePaymentStatus;
  let syncFailed = false;
  if (from === "stripe" && env.stripe.enabled) {
    // Stripe の登録画面から戻ったときは、最新の状態を取り直す（Webhook の到着を待たない）
    try {
      status = await refreshConnectStatus(viewer.id, store.storeId);
    } catch (e) {
      console.error("[connect] refresh failed", e);
      syncFailed = true;
      status = await getStorePaymentStatus(viewer.id, store.storeId);
    }
  } else {
    status = await getStorePaymentStatus(viewer.id, store.storeId);
  }
  const owner = store.role === "owner";
  const ready = status.chargesEnabled && status.detailsSubmitted;

  return (
    <div className="space-y-6">
      <PageHeader title="売上受取設定" />
      <p className="text-[13px] leading-relaxed text-ink-2">
        TABETUNAGU のオンライン決済の売上を受け取るための設定です（決済サービス Stripe を利用します）。
        設定が完了するまで、お客様はこの店舗の商品を購入できません。
      </p>

      {(error || syncFailed) && <Notice tone="error">Stripe との通信に失敗しました。時間をおいてもう一度お試しください。</Notice>}
      {!env.stripe.enabled && <Notice>オンライン決済は現在準備中です。</Notice>}

      <dl className="card divide-y divide-line text-[14px]" data-testid="connect-status">
        <Row label="決済の受付" ok={status.chargesEnabled} />
        <Row label="売上の入金" ok={status.payoutsEnabled} />
        <Row label="登録情報の提出" ok={status.detailsSubmitted} />
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-ink-2">設定完了日時</dt>
          <dd className="tnum">{dateTime(status.onboardingCompletedAt)}</dd>
        </div>
      </dl>

      {owner && env.stripe.enabled && !ready && (
        <ConnectOnboardingForm storeId={store.storeId} label={status.connected ? "売上受取設定を続ける" : "売上受取設定を始める"} />
      )}
      {!owner && !ready && <Notice>売上受取設定は店舗オーナーが行います。</Notice>}
      {ready && <Notice tone="success">設定が完了しています。お客様はオンラインで購入できます。</Notice>}
    </div>
  );
}

function Row({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt className="text-ink-2">{label}</dt>
      <dd>{ok ? <Badge tone="green">完了</Badge> : <Badge tone="outline">未完了</Badge>}</dd>
    </div>
  );
}
