import Link from "next/link";
import { autoRelistAdminAction, refreshDemoAction, sweepAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/admin/ActionButton";
import { DashboardPeriodTabs, DashSection, KpiCard, Metric, SeverityBadge } from "@/components/admin/Dashboard";
import { FlagBadge } from "@/components/admin/FlagBadge";
import { Bars } from "@/components/charts/Bars";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { Badge } from "@/components/ui/Badge";
import { PLANS } from "@/lib/fees";
import { grams, num, percent, yen } from "@/lib/format";
import { parseDashboardPeriod, type Severity } from "@/lib/poc-dashboard";
import type { StoreLaunchStatus } from "@/lib/readiness";
import { env } from "@/server/env";
import { getKpis, listStoresWithMetrics, MIN_RESOLVED_FOR_FLAG, SUSPICIOUS_QR_RATE } from "@/server/services/admin";
import { getPocDashboard, STORE_HEALTH_LABEL, type PocDashboard } from "@/server/services/poc-dashboard";
import { requireAdmin } from "@/server/auth/viewer";

/**
 * 管理ダッシュボード（PoC 運営の判断用）。上から: PoC ステータス・要対応 → PoC KPI → 売上 → 店舗 → ユーザー → STANDARD 候補 → 決済・リスク / 技術状態。
 * 集計値だけを表示し、ユーザー個人の情報（名前・LINE ID・IP・User-Agent・Stripe の ID）は出さない。
 * 判定の定義・目標値は src/lib/poc-dashboard.ts。
 */
export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin("/admin");
  const period = parseDashboardPeriod((await searchParams).period);
  const d = await getPocDashboard(period);

  return (
    <div className="space-y-9" data-testid="admin-dashboard">
      <PageHeader title="PoC ダッシュボード" sub={`期間: ${d.range.label}`} action={<DashboardPeriodTabs period={period} />} />

      <StatusAndAlerts d={d} />

      <DashSection
        title="PoC KPI"
        sub="母数が少ない指標は「データ不足」として判定しません。30日リピート率・店舗WAU は期間切替の影響を受けません。"
        testId="admin-poc-kpis"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {d.kpis.map((k) => (
            <KpiCard key={k.key} kpi={k} />
          ))}
        </div>
      </DashSection>

      <DashSection title="売上" sub="決済済みの注文を決済日時で計上（未受取を含み、返金・決済待ち・キャンセルを除く）" testId="admin-v2-kpis">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="GMV（商品の売上）" value={yen(d.sales.gmv)} sub={`決済済み注文 ${num(d.sales.orders)}件`} strong testId="metric-gmv" />
          <Metric
            label="プラットフォーム売上（実売上）"
            value={yen(d.sales.platformRevenue)}
            sub={`手数料 ${yen(d.sales.commission)}・つなぐチャージ ${yen(d.sales.tsunaguCharge)}`}
            strong
            testId="metric-platform-revenue"
          />
          <Metric label="返金" value={yen(d.sales.refunds.amount)} sub={`${num(d.sales.refunds.count)}件`} testId="metric-refunds" />
          <Link href="/admin/unclaimed" className="block">
            <Metric
              label="未受取"
              value={`${num(d.sales.unclaimed.count)}件`}
              sub={`未受取率 ${percent(d.sales.unclaimed.rate)}（受取結果 ${num(d.sales.unclaimed.count + d.sales.unclaimed.pickedUp)}件中）・${yen(d.sales.unclaimed.amount)}`}
              testId="metric-unclaimed"
            />
          </Link>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          STANDARD の月額（{yen(PLANS.standard.monthlyFee)}）は課金（Billing）が未実装のため、実売上に含めていません。未受取は決済済みのため売上に含みます。
        </p>
      </DashSection>

      <StoresSection d={d} />

      <DashSection title="ユーザー" sub="期間内に決済した人数（返金・キャンセルを除く）" testId="admin-users">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="購入ユーザー" value={`${num(d.users.buyers)}人`} />
          <Metric label="初回購入" value={`${num(d.users.firstTime)}人`} sub="最初の購入が期間内" />
          <Metric label="リピート購入" value={`${num(d.users.repeatBuyers)}人`} sub="期間内に購入し、累計2回以上" />
          <Metric
            label="30日リピート率"
            value={percent(d.kpis.find((k) => k.key === "repeatRate")!.value)}
            sub={`対象 ${num(d.kpis.find((k) => k.key === "repeatRate")!.denominator)}人（期間切替の影響なし）`}
          />
        </div>
      </DashSection>

      <StandardSection d={d} />

      <TechSection d={d} period={period} />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <DashSection title="日別の GMV・受取完了" sub={`期間: ${d.range.label}${period === "all" ? "（最大90日）" : ""}`} testId="admin-trend">
          <div className="card grid gap-6 p-5 md:grid-cols-2">
            <div>
              <p className="mb-2 text-[12px] text-muted">GMV（円）</p>
              <Bars data={d.trend.map((t) => ({ label: t.day, value: t.gmv }))} valueLabel={(v) => yen(v)} />
            </div>
            <div>
              <p className="mb-2 text-[12px] text-muted">受取完了（件）</p>
              <Bars data={d.trend.map((t) => ({ label: t.day, value: t.pickedUp }))} />
            </div>
          </div>
        </DashSection>
        <DashSection title="つなぐポイント" testId="admin-points">
          <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
            <Metric label="発行（期間内）" value={`${num(d.points.issued)}pt`} />
            <Metric label="取消（期間内）" value={`${num(d.points.revoked)}pt`} />
            <Metric label="現在の残高（全体）" value={`${num(d.points.outstanding)}pt`} />
          </div>
        </DashSection>
      </div>

      <GoNoGo d={d} />

      <LegacySection />

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

function StatusAndAlerts({ d }: { d: PocDashboard }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(260px,1fr)_3fr]" data-testid="admin-status">
      <div className="card p-5" data-testid="poc-status" data-status={d.status.key}>
        <p className="text-[12px] font-bold text-ink-2">PoC ステータス</p>
        <div className="mt-2 flex items-center gap-2">
          <p className="text-[28px] font-bold leading-none">{d.status.label}</p>
          <SeverityBadge severity={d.status.severity} />
        </div>
        <p className="mt-2 text-[12.5px] text-ink-2">{d.status.note}</p>
      </div>
      <div className="card p-5" data-testid="admin-alerts">
        <h2 className="text-[15px] font-bold">要対応</h2>
        {d.alerts.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-[14px] text-forest-2" data-testid="alerts-empty">
            <SeverityBadge severity="ok" />
            現在、重大な要対応項目はありません。
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {d.alerts.map((a) => {
              const body = (
                <>
                  <SeverityBadge severity={a.severity} />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{a.label}</span>
                    {a.note && <span className="block text-[12px] text-ink-2">{a.note}</span>}
                  </span>
                  {a.count !== null && <span className="tnum text-[16px] font-bold">{num(a.count)}{a.key === "connect" || a.key === "unclaimed" ? "店舗" : "件"}</span>}
                </>
              );
              return (
                <li key={a.key} data-testid={`alert-${a.key}`} data-severity={a.severity}>
                  {a.href ? (
                    <Link href={a.href} className="flex items-center gap-3 py-2.5 text-[14px] hover:bg-canvas">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 py-2.5 text-[14px]">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-[11.5px] text-muted">
          紛争（Dispute）・早期不正警告（Early Fraud Warning）はまだ取り込んでいません。Stripe ダッシュボードで確認してください。
        </p>
      </div>
    </section>
  );
}

const READINESS_ORDER: StoreLaunchStatus[] = ["未設定", "商品準備中", "Stripe設定待ち", "公開準備OK"];

function StoresSection({ d }: { d: PocDashboard }) {
  const s = d.stores;
  return (
    <DashSection
      title="店舗"
      sub="稼働している店舗（出品・Stripe 準備）を優先して表示します"
      action={
        <Link href="/admin/stores" className="text-[13px] font-semibold text-forest">
          店舗一覧
        </Link>
      }
      testId="admin-stores"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="本日出品した店舗" value={`${num(s.listedToday)}店舗`} strong testId="metric-listed-today" />
        <Metric label="7日以内に出品" value={`${num(s.listed7d)}店舗`} sub={`稼働中 ${num(s.active)}店舗のうち`} strong />
        <Metric label="公開中の商品あり" value={`${num(s.withLiveProducts)}店舗`} />
        <Metric label="Stripe 準備完了" value={`${num(s.stripeReady)}店舗`} sub={`稼働中 ${num(s.active)}店舗のうち`} />
        <Metric label="商品登録あり" value={`${num(s.withProducts)}店舗`} />
        <Metric label="登録店舗" value={`${num(s.total)}店舗`} sub={`稼働中 ${num(s.active)}`} />
      </div>
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1fr_2fr]">
        <div className="card p-4" data-testid="admin-readiness">
          <h3 className="text-[14px] font-bold">公開準備</h3>
          <ul className="mt-2 space-y-1.5 text-[13.5px]">
            {READINESS_ORDER.map((k) => (
              <li key={k}>
                <Link href="/admin/stores" className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-canvas" data-testid={`readiness-${k}`}>
                  <span>{k}</span>
                  <span className="tnum font-bold">{num(s.readiness[k])}店舗</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4" data-testid="admin-store-health">
          <h3 className="text-[14px] font-bold">フォローが必要な店舗</h3>
          {s.health.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted">現在、フォローが必要な店舗はありません。</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead className="text-left text-[12px] text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3">店舗</th>
                    <th className="px-3 py-2">プラン</th>
                    <th className="px-3 py-2 text-right">直近30日の売上</th>
                    <th className="px-3 py-2 text-right">未受取率</th>
                    <th className="py-2 pl-3">理由</th>
                  </tr>
                </thead>
                <tbody>
                  {s.health.slice(0, 10).map((h) => (
                    <tr key={h.id} className="border-b border-line last:border-0">
                      <td className="py-2 pr-3">
                        <Link href={`/admin/stores/${h.id}`} className="font-semibold hover:underline">
                          {h.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{h.plan === "standard" ? "STANDARD" : "FREE"}</td>
                      <td className="tnum px-3 py-2 text-right">{yen(h.sales30d)}</td>
                      <td className="tnum px-3 py-2 text-right">{percent(h.unclaimedRate)}</td>
                      <td className="py-2 pl-3">
                        <span className="flex flex-wrap gap-1">
                          {h.issues.map((i) => (
                            <Badge key={i} tone={i === "high_unclaimed" || i === "stripe_pending" ? "clay" : "outline"}>
                              {STORE_HEALTH_LABEL[i]}
                            </Badge>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {s.health.length > 10 && <p className="mt-2 text-[12px] text-muted">ほか{s.health.length - 10}店舗（店舗一覧で確認できます）</p>}
            </div>
          )}
        </div>
      </div>
    </DashSection>
  );
}

function StandardSection({ d }: { d: PocDashboard }) {
  const { breakEven, candidates } = d.standard;
  return (
    <DashSection
      title="STANDARD 候補"
      sub={`FREE 店舗の直近30日の売上（決済済み）が損益分岐 ${yen(breakEven)} 以上、または近い店舗（最大10店舗）`}
      testId="admin-standard"
    >
      {candidates.length === 0 ? (
        <p className="card px-4 py-4 text-[13px] text-muted">損益分岐に近い FREE 店舗はまだありません。</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="text-left text-[12px] text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5">店舗</th>
                <th className="px-3 py-2.5 text-right">直近30日の売上</th>
                <th className="px-3 py-2.5">損益分岐</th>
                <th className="px-3 py-2.5 text-right">手数料負担（試算）FREE / STANDARD</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0" data-testid="standard-candidate" data-over={c.over ? "yes" : "no"}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/stores/${c.id}`} className="font-semibold hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="tnum px-3 py-3 text-right font-semibold">{yen(c.sales)}</td>
                  <td className="px-3 py-3">
                    {c.over ? <SeverityBadge severity="ok" label="損益分岐以上" /> : <span className="tnum text-ink-2">あと {yen(c.gap)}</span>}
                  </td>
                  <td className="tnum px-3 py-3 text-right text-ink-2">
                    {yen(c.freeFee)} / {yen(c.standardFee)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[12px] text-muted">
        同じ売上が続いた場合の試算です。STANDARD にすると手数料負担が小さくなる可能性がありますが、必ずお得になるとは限りません（売上は月によって変わります）。
      </p>
    </DashSection>
  );
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span>{label}</span>
      <SeverityBadge severity={ok ? "ok" : "critical"} label={ok ? "設定済み" : "未設定"} />
    </li>
  );
}

/** 決済・リスク / 技術状態（秘密情報の値は表示しない。設定の有無と状態だけ） */
function TechSection({ d, period }: { d: PocDashboard; period: string }) {
  const t = d.tech;
  const flagSeverity: Severity = t.flag.state === "forced_off" ? "critical" : t.flag.state === "on" ? "ok" : "warning";
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <DashSection title="決済・リスク" testId="admin-risk">
        <ul className="card divide-y divide-line px-4 text-[13.5px]">
          <li>
            <Link href="/admin/review" className="flex items-center justify-between gap-3 py-2.5 hover:underline" data-testid="risk-review">
              <span>要確認の決済（requires_review）</span>
              <SeverityBadge severity={d.risk.requiresReview > 0 ? "critical" : "ok"} label={`${num(d.risk.requiresReview)}件`} />
            </Link>
          </li>
          <li>
            <Link href="/admin/review" className="flex items-center justify-between gap-3 py-2.5 hover:underline">
              <span>失敗した返金</span>
              <SeverityBadge severity={d.risk.refundsFailed > 0 ? "critical" : "ok"} label={`${num(d.risk.refundsFailed)}件`} />
            </Link>
          </li>
          <li className="flex items-center justify-between gap-3 py-2.5">
            <span>紛争（Dispute）・早期不正警告</span>
            <span className="text-[12px] text-muted">未連携（Stripe ダッシュボードで確認）</span>
          </li>
          <li>
            <Link href="/admin/unclaimed" className="flex items-center justify-between gap-3 py-2.5 hover:underline" data-testid="risk-unclaimed">
              <span>未受取の一覧</span>
              <span className="tnum text-[13px] font-semibold">{num(d.sales.unclaimed.count)}件（{percent(d.sales.unclaimed.rate)}）</span>
            </Link>
          </li>
        </ul>
      </DashSection>

      <section className="space-y-3" data-testid="launch-readiness" aria-label="技術状態">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-[16px] font-bold">技術状態・PoC 公開準備</h2>
          <div className="flex items-center gap-2" data-testid="flag-status" data-flag={t.flag.state}>
            <span className="text-[12px] text-muted">ENABLE_V2_CHECKOUT</span>
            <SeverityBadge severity={flagSeverity} label={t.flag.label} />
          </div>
        </div>
        {t.flag.reasons.length > 0 && (
          <p className="rounded-xl bg-clay-soft px-4 py-3 text-[13px] text-clay" data-testid="flag-reasons">
            v2 を有効にするには次の設定が必要です: {t.flag.reasons.join("、")}
          </p>
        )}
        <div className="card grid gap-x-6 px-4 py-2 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <ul className="divide-y divide-line text-[13px]">
            <Check label="Stripe 秘密鍵（Secret Key）" ok={t.stripe.secretKey} />
            <Check label="Stripe Webhook Secret" ok={t.stripe.webhookSecret} />
            <Check label="Checkout の戻り先 URL（https）" ok={t.stripe.checkoutReturnUrl} />
            <Check label="CRON_SECRET" ok={t.cronSecret} />
          </ul>
          <ul className="divide-y divide-line text-[13px]">
            <li className="py-1.5" data-testid="cron-status">
              <span className="flex items-center justify-between gap-3">
                <span>定期処理（/api/cron/orders）</span>
                <SeverityBadge severity={t.cron.severity} />
              </span>
              <span className="block text-[12px] text-muted">{t.cron.text}</span>
            </li>
            <li className="flex items-center justify-between gap-3 py-1.5">
              <span>Stripe 未設定の稼働店舗</span>
              <SeverityBadge severity={t.storesConnectPending > 0 ? "warning" : "ok"} label={`${num(t.storesConnectPending)}店舗`} />
            </li>
            <li className="flex items-center justify-between gap-3 py-1.5">
              <Link href="/admin/review" className="font-semibold text-forest hover:underline">
                要確認の決済（requires_review）
              </Link>
              <span className="tnum">{num(d.risk.requiresReview)}件</span>
            </li>
          </ul>
        </div>
        <p className="text-[12px] text-muted">
          CSV 出力（個人情報なし）:{" "}
          <a href={`/admin/export?type=orders&period=${period}`} className="font-semibold text-forest underline" data-testid="csv-orders">
            注文
          </a>
          ・
          <a href={`/admin/export?type=stores&period=${period}`} className="font-semibold text-forest underline" data-testid="csv-stores">
            店舗別
          </a>
        </p>
      </section>
    </div>
  );
}

function GoNoGo({ d }: { d: PocDashboard }) {
  const g = d.goNoGo;
  return (
    <section className="card border-2 border-line p-5" data-testid="admin-go-no-go" aria-label="PoC 判定の参考">
      <h2 className="text-[15px] font-bold">PoC 判定の参考</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="主要 KPI" value={`${g.achieved} / ${g.total} 達成`} sub={g.insufficient > 0 ? `データ不足 ${g.insufficient}` : undefined} />
        <Metric label="要対応（対応必要）" value={`${g.actionRequired}件`} />
      </div>
      <p className="mt-3 text-[13px] font-semibold text-ink" data-testid="go-no-go-verdict">
        {g.verdict}
      </p>
      <p className="mt-1 text-[12px] text-muted">
        Stripe テストモードの疎通・LINE 実機確認・法務確認は POC_GO_LIVE_CHECKLIST.md で人が確認します。KPI が良くても、この画面だけで Go とは判断しません。
      </p>
    </section>
  );
}

/** 旧フロー（店頭払い・QR）の指標。v2 の判断には使わないため折りたたむ（直近30日で固定） */
async function LegacySection() {
  const [k, stores] = await Promise.all([getKpis("30d"), listStoresWithMetrics("30d")]);
  const flagged = stores.filter((s) => s.flag === "suspicious" || s.flag === "warning");
  return (
    <details className="card p-5" data-testid="admin-legacy">
      <summary className="cursor-pointer text-[15px] font-bold">旧フロー（店頭払い・QR）の指標（直近30日）</summary>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="予約数" value={num(k.reservations)} sub={`キャンセル ${num(k.cancelled)}`} />
        <Metric label="成約数" value={num(k.completions)} sub="QRチェックイン完了" />
        <Metric label="QR完了率" value={percent(k.qrRate)} sub="受取時間を過ぎた予約のうち" />
        <Metric label="No Show率" value={percent(k.noShowRate)} sub={`${num(k.noShow)}件`} />
        <Metric label="GMV（成約額）" value={yen(k.gmv)} sub={`手数料 ${yen(k.commission)}`} />
        <Metric label="推定食品ロス削減（旧フロー）" value={grams(k.foodSavedG)} sub="商品の推定重量からの概算" />
      </div>
      <div className="mt-4">
        <p className="text-[12px] text-muted">
          QR完了率が低い店舗（受取時間を過ぎた予約 {MIN_RESOLVED_FOR_FLAG}件以上で {percent(SUSPICIOUS_QR_RATE)} 未満を「要確認」）
        </p>
        {flagged.length === 0 ? (
          <p className="mt-1 text-[13px] text-muted">該当する店舗はありません。</p>
        ) : (
          <ul className="mt-2 space-y-1 text-[13px]">
            {flagged.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <Link href={`/admin/stores/${s.id}`} className="font-semibold hover:underline">
                  {s.name}
                </Link>
                <span className="tnum text-ink-2">{percent(s.qrRate)}</span>
                <FlagBadge flag={s.flag} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
