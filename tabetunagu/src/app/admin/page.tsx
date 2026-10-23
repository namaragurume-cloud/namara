import Link from "next/link";
import { autoRelistAdminAction, refreshDemoAction, sweepAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/admin/ActionButton";
import { FlagBadge } from "@/components/admin/FlagBadge";
import { parsePeriod, PeriodTabs } from "@/components/admin/PeriodTabs";
import { Bars } from "@/components/charts/Bars";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { Stat } from "@/components/ui/Section";
import { BREAK_EVEN_GMV, PLANS } from "@/lib/fees";
import { grams, num, percent, yen } from "@/lib/format";
import { env } from "@/server/env";
import { features } from "@/lib/features";
import { ORDER_POLICY } from "@/lib/orders";
import { Notice } from "@/components/ui/Section";
import { getKpis, listStoresWithMetrics, MIN_RESOLVED_FOR_FLAG, periodRange, SUSPICIOUS_QR_RATE } from "@/server/services/admin";
import { getV2Kpis } from "@/server/services/v2-metrics";
import { CRON_STALE_MINUTES, getOpsReadiness, type OpsReadiness } from "@/server/services/ops";
import { Badge } from "@/components/ui/Badge";

export default async function AdminKpiPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = parsePeriod((await searchParams).period);
  const range = periodRange(period);
  const [k, stores, v2, ops] = await Promise.all([
    getKpis(period),
    listStoresWithMetrics(period),
    getV2Kpis(range.from, range.to, ORDER_POLICY.pickupLateGraceMinutes),
    getOpsReadiness(),
  ]);
  const flagged = stores.filter((s) => s.flag === "suspicious" || s.flag === "warning");

  return (
    <div className="space-y-8">
      <PageHeader title="KPI" sub={k.label} action={<PeriodTabs base="/admin" period={period} />} />

      <LaunchReadiness ops={ops} period={period} />

      {v2.maintenanceBacklog > 0 && (
        <Notice tone="error">
          決済期限切れ・受取期限切れのまま30分以上処理されていない注文が {num(v2.maintenanceBacklog)} 件あります。定期処理（/api/cron/orders を5分ごと）が動いているか確認してください。
          {features.v2Journey ? "" : "（v2 の購入導線は OFF です）"}
        </Notice>
      )}
      {v2.requiresReview > 0 && (
        <Notice tone="error">金額・店舗などが注文と一致しない決済（requires_review）が {num(v2.requiresReview)} 件あります。</Notice>
      )}

      <section data-testid="admin-v2-kpis">
        <h2 className="mb-3 text-[14px] font-bold text-ink-2">事前決済（v2）{features.v2Journey ? "" : "・購入導線 OFF"}</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="GMV（商品の売上）" value={yen(v2.gmv)} sub={`決済総額 ${yen(v2.charged)}`} />
          <Stat label="決済済み注文" value={num(v2.paidOrders)} sub="返金済みを除く" />
          <Stat label="受取完了" value={num(v2.pickedUp)} />
          <Stat label="未受取" value={num(v2.unclaimed)} sub="売上には含む" />
          <Stat label="返金" value={num(v2.refunded)} />
          <Stat label="プラットフォーム売上" value={yen(v2.platformRevenue)} sub={`手数料 ${yen(v2.commission)}・チャージ ${yen(v2.tsunaguCharge)}`} />
          <Stat label="発行ポイント" value={`${num(v2.points.issued)}pt`} sub={`取り消し ${num(v2.points.revoked)}pt・残高 ${num(v2.points.outstanding)}pt`} />
          <Stat label="合計 GMV（旧＋v2）" value={yen(k.gmv + v2.gmv)} sub="別々の取引の合計" />
        </div>
      </section>

      <section data-testid="admin-poc-kpis">
        <h2 className="mb-1 text-[14px] font-bold text-ink-2">PoC 指標</h2>
        <p className="mb-3 text-[12px] text-muted">定義は src/server/services/v2-metrics.ts（getV2Kpis）に記載しています。</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          <Stat label="自己スワイプ完了率" value={percent(v2.poc.swipeRate)} sub={`受取期限が来た注文 ${num(v2.poc.swipeDue)}件のうち`} />
          <Stat label="食べつなぎ率" value={percent(v2.poc.tsunagiRate)} sub="売れた数量 ÷ 出品数量（旧＋v2）" />
          <Stat label="30日リピート率（v2）" value={percent(v2.poc.repeatRate)} sub={`対象 ${v2.poc.repeatCohort}人`} />
          <Stat label="店舗 WAU" value={num(v2.poc.storeWau)} sub="直近7日に出品した店舗" />
          <Stat
            label="STANDARD 移行対象"
            value={num(v2.poc.upgradeCandidates.length)}
            sub={v2.poc.upgradeCandidates.slice(0, 3).map((s) => s.name).join("・") || `直近30日 ${yen(BREAK_EVEN_GMV)} 以上の FREE 店舗`}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[14px] font-bold text-ink-2">店舗</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="登録店舗" value={k.stores.total} sub={`稼働中ステータス ${k.stores.active}`} />
          <Stat label="稼働店舗" value={k.stores.operating} sub="期間内に出品あり" />
          <Stat label="店舗稼働率" value={percent(k.stores.operatingRate)} />
          <Stat label="FREE 店舗" value={k.stores.free} />
          <Stat label="STANDARD 店舗" value={k.stores.standard} sub={percent(k.stores.standard / Math.max(1, k.stores.free + k.stores.standard))} />
          <Stat label="出品数" value={num(k.listings)} sub={`${num(k.listedQty)}点`} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[14px] font-bold text-ink-2">ユーザー・予約</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="登録ユーザー" value={num(k.users.total)} sub={`期間内の新規 ${num(k.users.new)}`} />
          <Stat label="MAU" value={num(k.users.mau)} sub="直近30日のアクティブ" />
          <Stat label="予約数" value={num(k.reservations)} sub={`キャンセル ${num(k.cancelled)}`} />
          <Stat label="成約数" value={num(k.completions)} sub="QRチェックイン完了" />
          <Stat label="30日リピート率" value={percent(k.repeatRate)} sub={`対象 ${k.repeatCohort}人`} />
          <Stat label="推定食品ロス削減" value={grams(k.foodSavedG)} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[14px] font-bold text-ink-2">店頭払い（旧フロー）の成約の質・売上</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="食べつなぎ率" value={percent(k.tsunagiRate)} sub="成約数量 ÷ 出品数量" />
          <Stat label="QR完了率" value={percent(k.qrRate)} sub="受取時間を過ぎた予約のうち" />
          <Stat label="No Show率" value={percent(k.noShowRate)} sub={`${num(k.noShow)}件`} />
          <Stat label="GMV（成約額）" value={yen(k.gmv)} sub="店舗で支払われた額" />
          <Stat label="成約手数料売上" value={yen(k.commission)} />
          <Stat label="月額売上" value={k.monthlyFees == null ? "—" : yen(k.monthlyFees)} sub={`STANDARD × ${yen(PLANS.standard.monthlyFee)}`} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-[15px] font-bold">直近14日の予約・成約</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[12px] text-muted">予約数</p>
            <Bars data={k.trend.map((t) => ({ label: t.day, value: t.reservations }))} />
          </div>
          <div>
            <p className="mb-2 text-[12px] text-muted">成約数</p>
            <Bars data={k.trend.map((t) => ({ label: t.day, value: t.completions }))} />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-[15px] font-bold">QR完了率が低い店舗</h2>
            <p className="text-[12px] text-muted">
              受取時間を過ぎた予約 {MIN_RESOLVED_FOR_FLAG}件以上で、QR完了率 {percent(SUSPICIOUS_QR_RATE)} 未満を「要確認」としています。店頭での受け渡しがQRを通らずに行われている（成約漏れ）可能性があります。
            </p>
          </div>
          <Link href={`/admin/stores?period=${period}`} className="shrink-0 text-[13px] font-semibold text-forest">
            店舗ごとの完了率
          </Link>
        </div>
        {flagged.length === 0 ? (
          <p className="card px-4 py-4 text-[13px] text-muted">該当する店舗はありません。</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="text-left text-[12px] text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5">店舗</th>
                  <th className="px-3 py-2.5 text-right">予約</th>
                  <th className="px-3 py-2.5 text-right">QR完了</th>
                  <th className="px-3 py-2.5 text-right">未来店</th>
                  <th className="px-3 py-2.5 text-right">QR完了率</th>
                  <th className="px-4 py-2.5">判定</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/stores/${s.id}`} className="font-semibold hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="tnum px-3 py-3 text-right">{s.reservations}</td>
                    <td className="tnum px-3 py-3 text-right">{s.completed}</td>
                    <td className="tnum px-3 py-3 text-right">{s.noShow}</td>
                    <td className="tnum px-3 py-3 text-right font-semibold">{percent(s.qrRate)}</td>
                    <td className="px-4 py-3">
                      <FlagBadge flag={s.flag} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-[15px] font-bold">運用</h2>
        <p className="mt-1 text-[12px] text-muted">本番では Vercel Cron が自動で実行します（vercel.json）。手動でも実行できます。</p>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <ActionButton action={sweepAction} label="No Show / 期限切れ判定を実行" />
          <ActionButton action={autoRelistAdminAction} label="自動再出品を実行" />
          {env.demoLoginEnabled && <ActionButton action={refreshDemoAction} label="デモの出品を今日の日付で作り直す" confirm="デモ店舗の今日の出品を作り直します。" />}
        </div>
      </section>
    </div>
  );
}

function Check({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        {detail && <span className="text-[12px] text-muted">{detail}</span>}
        <Badge tone={ok ? "green" : "clay"}>{ok ? "OK" : "要対応"}</Badge>
      </span>
    </li>
  );
}

/** PoC 公開準備（秘密情報の値は表示しない。設定の有無と状態だけ） */
function LaunchReadiness({ ops, period }: { ops: OpsReadiness; period: string }) {
  const f = ops.flag;
  const cron =
    ops.cron.state === "never"
      ? "未実行"
      : `最終実行 ${ops.cron.minutesAgo}分前${ops.cron.state === "stale" ? `（${CRON_STALE_MINUTES}分以上前）` : ""}`;
  return (
    <section className="card space-y-4 p-5" data-testid="launch-readiness">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold">PoC 公開準備</h2>
        <div className="flex items-center gap-2" data-testid="flag-status">
          <span className="text-[12px] text-muted">ENABLE_V2_CHECKOUT</span>
          {f.effective ? (
            <Badge tone={f.enforced ? "clay" : "dark"}>{f.enforced ? "ON（本番で有効）" : "ON"}</Badge>
          ) : f.requested ? (
            <Badge tone="clay">ON 指定・設定不足のため OFF</Badge>
          ) : (
            <Badge tone="outline">OFF（旧導線）</Badge>
          )}
        </div>
      </div>
      {f.requested && !f.effective && (
        <p className="rounded-xl bg-clay-soft px-4 py-3 text-[13px] text-clay">
          v2 を有効にするには次の設定が必要です: {f.missing.join("、")}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <ul className="divide-y divide-line text-[13px]">
          <Check label="Stripe 秘密鍵" ok={ops.stripe.secretKey} />
          <Check label="Stripe Webhook 署名鍵" ok={ops.stripe.webhookSecret} />
          <Check label="Checkout の戻り先 URL（https）" ok={ops.stripe.checkoutReturnUrl} />
          <Check label="CRON_SECRET" ok={ops.cronSecret} />
        </ul>
        <ul className="divide-y divide-line text-[13px]">
          <Check label="定期処理（/api/cron/orders）" ok={ops.cron.state === "ok"} detail={cron} />
          <Check
            label="売上受取設定が未完了の稼働店舗"
            ok={ops.storesConnectPending === 0}
            detail={`${ops.storesConnectPending} / ${ops.storesActive}店舗`}
          />
          <li className="flex items-center justify-between gap-3 py-1.5">
            <Link href="/admin/review" className="font-semibold text-forest hover:underline">
              要確認の決済（requires_review）
            </Link>
            <Badge tone={ops.requiresReview === 0 ? "green" : "clay"}>{ops.requiresReview}件</Badge>
          </li>
          <Check label="失敗した返金" ok={ops.refundsFailed === 0} detail={`${ops.refundsFailed}件`} />
        </ul>
      </div>
      <p className="text-[12px] text-muted">
        Stripe テストモードの疎通・LINE 実機確認は POC_GO_LIVE_CHECKLIST.md で管理します（この画面では判定できません）。
        <span className="ml-2">
          CSV:{" "}
          <a href={`/admin/export?type=orders&period=${period}`} className="text-forest underline">
            注文
          </a>
          ・
          <a href={`/admin/export?type=stores&period=${period}`} className="text-forest underline">
            店舗別
          </a>
          ・
          <Link href="/admin/unclaimed" className="text-forest underline">
            未受取の一覧
          </Link>
        </span>
      </p>
    </section>
  );
}
