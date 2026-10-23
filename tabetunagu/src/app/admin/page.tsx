import Link from "next/link";
import { autoRelistAdminAction, refreshDemoAction, sweepAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/admin/ActionButton";
import { FlagBadge } from "@/components/admin/FlagBadge";
import { parsePeriod, PeriodTabs } from "@/components/admin/PeriodTabs";
import { Bars } from "@/components/charts/Bars";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { Stat } from "@/components/ui/Section";
import { PLANS } from "@/lib/fees";
import { grams, num, percent, yen } from "@/lib/format";
import { env } from "@/server/env";
import { getKpis, listStoresWithMetrics, MIN_RESOLVED_FOR_FLAG, SUSPICIOUS_QR_RATE } from "@/server/services/admin";

export default async function AdminKpiPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = parsePeriod((await searchParams).period);
  const [k, stores] = await Promise.all([getKpis(period), listStoresWithMetrics(period)]);
  const flagged = stores.filter((s) => s.flag === "suspicious" || s.flag === "warning");

  return (
    <div className="space-y-8">
      <PageHeader title="KPI" sub={k.label} action={<PeriodTabs base="/admin" period={period} />} />

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
        <h2 className="mb-3 text-[14px] font-bold text-ink-2">成約の質・売上</h2>
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
