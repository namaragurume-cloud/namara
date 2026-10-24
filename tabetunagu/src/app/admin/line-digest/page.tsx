import type { Metadata } from "next";
import { runDigestNowAction, sendDigestTestAction } from "@/app/actions/line-digest";
import { ActionButton } from "@/components/admin/ActionButton";
import { Metric } from "@/components/admin/Dashboard";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { ProductVisual } from "@/components/product/ProductVisual";
import { Badge } from "@/components/ui/Badge";
import { dateTime, num } from "@/lib/format";
import { DIGEST_MAX_CONSECUTIVE_FAILURES, DIGEST_REPEAT_DAYS } from "@/lib/featured-digest";
import { requireAdmin } from "@/server/auth/viewer";
import { env } from "@/server/env";
import { getDigestDashboard } from "@/server/services/line-digest";

export const metadata: Metadata = { title: "LINE日次通知" };

const STATUS: Record<string, string> = { sent: "送信済み", failed: "失敗", skipped: "送信せず", dry_run: "dry run", pending: "送信中" };

/**
 * LINE 日次注目商品通知（「今夜の食べつなぎ」）の確認（管理者のみ）。
 * 送るのは通知を ON にしたユーザーだけ。Broadcast はしない。LINE の userId・トークンは表示しない。
 */
export default async function LineDigestPage() {
  await requireAdmin("/admin/line-digest");
  const d = await getDigestDashboard();
  const live = env.line.digestSendEnabled;
  const selfTest = Boolean(env.line.messagingAccessToken) && (env.line.marketingDemoEnabled || live);

  return (
    <div className="space-y-6" data-testid="line-digest">
      <PageHeader
        title="LINE日次通知（今夜の食べつなぎ）"
        sub={`「今日の注目商品」の通知を ON にしたユーザーだけに、1日1回まで最大3商品を送ります（配信日 ${d.date}・JST）。全員への一斉配信はしません。`}
      />

      <section className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-[13px]" data-testid="line-digest-flags">
        <span className="flex items-center gap-2">
          送信（ENABLE_LINE_DIGEST_SEND）
          <Badge tone={live ? "green" : "sand"}>{live ? "実送信" : "dry run"}</Badge>
        </span>
        <span className="flex items-center gap-2">
          定期実行（ENABLE_LINE_DIGEST_CRON）
          <Badge tone={env.line.digestCronEnabled ? "green" : "outline"}>{env.line.digestCronEnabled ? "有効（18:00）" : "無効"}</Badge>
        </span>
        <span className="flex items-center gap-2">
          アクセストークン
          <Badge tone={env.line.messagingAccessToken ? "green" : "outline"}>{env.line.messagingAccessToken ? "設定済み" : "未設定"}</Badge>
        </span>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="line-digest-metrics">
        <Metric label="通知ONユーザー" value={`${num(d.optIn)}人`} sub={d.demoOptIn > 0 ? `うちデモ ${num(d.demoOptIn)}人（対象外）` : undefined} testId="digest-opt-in" />
        <Metric label="配信対象（LINE連携・デモ以外）" value={`${num(d.eligible)}人`} testId="digest-eligible" />
        <Metric label="今日送信済み" value={`${num(d.today.sent + d.today.failed)}人`} sub={d.today.pending > 0 ? `送信中 ${num(d.today.pending)}` : undefined} strong testId="digest-today" />
        <Metric label="成功" value={`${num(d.today.sent)}人`} testId="digest-sent" />
        <Metric label="失敗" value={`${num(d.today.failed)}人`} testId="digest-failed" />
        <Metric label="dry run・送信せず" value={`${num(d.today.dryRun)} / ${num(d.today.skipped)}`} testId="digest-dry-run" />
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-bold">今日の商品（最大3件）</h2>
        {d.cards.length === 0 ? (
          <p className="card px-4 py-4 text-[13px] text-muted" data-testid="digest-no-products">
            今日の注目商品はありません（公開中・在庫あり・当日受取・受取終了まで30分以上の商品がない）。この場合は誰にも送りません。
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="digest-products">
            {d.cards.map((c) => (
              <li key={c.ctaUrl} className="overflow-hidden rounded-2xl border border-line bg-white">
                <ProductVisual imageUrl={c.imageUrl} category="other" alt="" sizes="300px" className="aspect-[20/13] w-full" />
                <div className="space-y-1 p-4">
                  <p className="text-[11px] font-bold text-forest">{c.title}</p>
                  <p className="text-[13px] text-ink-2">{c.storeName}</p>
                  <p className="text-[16px] font-bold leading-snug">{c.productName}</p>
                  <p className="tnum text-[14px] font-bold">
                    {c.priceLine}
                    {c.discount && <span className="ml-2 text-[12px] text-forest">{c.discount}</span>}
                  </p>
                  <p className="tnum text-[12.5px] text-ink-2">
                    {c.remaining}・受取 {c.pickup}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[12px] text-muted">
          選び方: 割引率が高い順 → 受取終了が近い順。まず1店舗1件ずつ、足りなければ1店舗2件まで。ユーザーごとに、直近{DIGEST_REPEAT_DAYS}日に送った商品は除きます。
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3 p-5">
          <h2 className="text-[15px] font-bold">手動テスト送信（自分だけ）</h2>
          <p className="text-[12.5px] text-ink-2">今日の商品を、ログイン中の自分の LINE にだけ1件送ります。ほかのユーザーには送りません。</p>
          {selfTest ? (
            <ActionButton action={sendDigestTestAction} label="自分のLINEにテスト送信" variant="dark" />
          ) : (
            <p className="text-[12px] text-muted">LINE_CHANNEL_ACCESS_TOKEN と、ENABLE_LINE_MARKETING_DEMO=true（または ENABLE_LINE_DIGEST_SEND=true）が必要です。</p>
          )}
        </div>
        <div className="card space-y-3 p-5">
          <h2 className="text-[15px] font-bold">今日の配信を手動で実行</h2>
          <p className="text-[12.5px] text-ink-2">
            通知を ON にしたユーザーだけが対象です（1人1日1回まで。今日すでに送った人には送りません）。
            {live ? " ENABLE_LINE_DIGEST_SEND=true のため、実際に LINE へ送ります。" : " 現在は dry run です（LINE へは送らず、対象と商品を記録するだけ）。"}
          </p>
          <ActionButton
            action={runDigestNowAction}
            label={live ? "通知ONのユーザーへ今日の分を送る" : "dry run を実行する"}
            variant={live ? "danger" : "secondary"}
            confirm={live ? "通知を ON にしたユーザーへ、今日の「今夜の食べつなぎ」を実際に送ります。よろしいですか？" : undefined}
          />
          <p className="text-[11.5px] text-muted">
            友だち未追加・ブロック中のユーザーには送りません（送信せず）。連続{DIGEST_MAX_CONSECUTIVE_FAILURES}回失敗したユーザーには、本人が通知を ON にし直すまで送りません。
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[15px] font-bold">直近の記録</h2>
        {d.recent.length === 0 ? (
          <p className="text-[13px] text-muted">まだ記録はありません。</p>
        ) : (
          <ul className="card divide-y divide-line text-[13px]" data-testid="digest-logs">
            {d.recent.map((l, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="tnum">{dateTime(l.created_at as unknown as string)}</span>
                <span>{l.notification_type === "featured_daily_test" ? "テスト（自分）" : "日次"}</span>
                <span className="tnum">{l.product_count}商品</span>
                <span>
                  {STATUS[l.status] ?? l.status}
                  {l.error_category && <span className="ml-1 text-muted">（{l.error_category}）</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
