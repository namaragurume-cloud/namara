import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { ConnectOnboardingForm } from "@/components/store/ConnectOnboardingForm";
import { CircleCheck } from "lucide-react";
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
      <section className="card p-5" data-testid="payout-summary" data-state={ready ? "done" : status.connected ? "in_progress" : "not_started"}>
        <p className="flex items-center gap-2 text-[17px] font-bold">
          {ready ? (
            <>
              <CircleCheck className="h-6 w-6 text-forest" aria-hidden />
              売上受取設定 完了
            </>
          ) : status.connected ? (
            "あと少しで完了です"
          ) : (
            "売上を受け取るための設定です"
          )}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
          {ready
            ? "お客様はオンラインで購入できます。売上は登録した口座に入金されます。"
            : status.connected
              ? "追加情報の入力が必要です。続きは決済サービス（Stripe）の画面で入力できます。"
              : "オンライン決済の売上を受け取る口座などを登録します（決済サービス Stripe を利用します）。設定が完了するまで、お客様はこの店舗の商品を購入できません。"}
        </p>
      </section>

      {(error || syncFailed) && <Notice tone="error">売上受取設定の状態を確認できませんでした。時間をおいてもう一度お試しください。</Notice>}
      {!env.stripe.enabled && <Notice>オンライン決済は現在準備中です。</Notice>}

      <dl className="card divide-y divide-line text-[14px]" data-testid="connect-status" aria-label="設定の詳細">
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
