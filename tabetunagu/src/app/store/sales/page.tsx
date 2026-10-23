import type { Metadata } from "next";
import Link from "next/link";
import { Bars } from "@/components/charts/Bars";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { ButtonLink } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Section";
import { PLANS } from "@/lib/fees";
import { percent, yen } from "@/lib/format";
import { jstMonthRange } from "@/lib/time";
import { requireStoreMember } from "@/server/auth/viewer";
import { getStoreSales } from "@/server/services/store";
import { getStoreOrderSales } from "@/server/services/v2-metrics";

export const metadata: Metadata = { title: "売上・手数料" };

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function StoreSalesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: raw } = await searchParams;
  const { viewer, store } = await requireStoreMember("/store/sales");
  const month = jstMonthRange(raw).month;
  const [s, v2] = await Promise.all([getStoreSales(viewer.id, store.storeId, month), getStoreOrderSales(viewer.id, store.storeId, month)]);
  const plan = PLANS[s.store.plan];
  const standard = s.store.plan === "standard";

  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const dailyMap = new Map(s.daily.map((d) => [d.day, d]));
  const daily = Array.from({ length: days }, (_, i) => {
    const day = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { label: String(i + 1), value: dailyMap.get(day)?.gmv ?? 0 };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="売上・手数料"
        sub="事前決済（オンライン）の売上と、店頭払い（旧フロー）の成約売上を分けて表示します。同じ取引が両方に入ることはありません。"
        action={
          <div className="flex items-center gap-1 text-[13px] font-semibold">
            <Link href={`/store/sales?month=${shiftMonth(month, -1)}`} className="rounded-full border border-line bg-paper px-3 py-1.5">
              前月
            </Link>
            <span className="tnum px-2">{month}</span>
            <Link href={`/store/sales?month=${shiftMonth(month, 1)}`} className="rounded-full border border-line bg-paper px-3 py-1.5">
              翌月
            </Link>
          </div>
        }
      />

      <section className="space-y-3" data-testid="v2-sales">
        <div>
          <h2 className="text-[15px] font-bold">事前決済の売上</h2>
          <p className="text-[12px] text-muted">
            お支払いが完了した注文を売上として計上します（受取完了・未受取を含み、返金済みは含みません）。成約手数料は決済時に差し引かれ、残りが店舗受取額です。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="本日の売上" value={yen(v2.today.sales)} sub={`${v2.today.orders}件`} />
          <Stat label="月間売上" value={yen(v2.month.sales)} sub={`注文 ${v2.month.orders}件`} />
          <Stat label="成約手数料" value={yen(v2.month.commission)} sub="決済手数料込み" />
          <Stat label="店舗受取額" value={yen(v2.month.storeNet)} sub="売上 − 成約手数料" />
          <Stat label="受取完了" value={`${v2.month.pickedUp}件`} />
          <Stat label="未受取" value={`${v2.month.unclaimed}件`} sub="売上には含みます" />
          <Stat label="受取待ち" value={`${v2.month.awaitingPickup}件`} />
          <Stat label="返金" value={`${v2.month.refunded}件`} sub={v2.month.refunded ? `${yen(v2.month.refundedAmount)}（売上に含めません）` : undefined} />
        </div>
      </section>

      <h2 className="text-[15px] font-bold">店頭払い（旧フロー）の成約</h2>
      <section className="grid gap-3 md:grid-cols-[1fr_1.2fr]">
        <div className="card p-5">
          <p className="text-[12px] font-semibold text-muted">TABETUNAGU 手数料（{plan.name}）</p>
          <p className="tnum mt-1 text-[32px] font-semibold">{yen(s.fee.total)}</p>
          <dl className="mt-3 space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted">月額</dt>
              <dd className="tnum">{yen(s.fee.monthlyFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">成約手数料（成約売上 {yen(s.fee.gmv)} × {plan.commissionBps / 100}%）</dt>
              <dd className="tnum">{yen(s.fee.commission)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[11.5px] text-muted">手数料率は成約時点のプランで計算します。円未満は切り捨てです。</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="成約売上（GMV）" value={yen(s.fee.gmv)} />
          <Stat label="成約件数" value={`${s.counts.completed}件`} />
          <Stat label="QR完了率" value={percent(s.counts.qrRate)} sub={`未来店 ${s.counts.noShow}件`} />
          <Stat label="食べつなぎ率" value={percent(s.counts.sellThrough)} sub={`出品 ${s.counts.listedQty}点`} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-[15px] font-bold">日別の成約売上</h2>
        <Bars data={daily} valueLabel={yen} />
      </section>

      {standard ? (
        <section className="grid gap-3 md:grid-cols-2">
          <div className="card p-5">
            <h2 className="mb-4 text-[15px] font-bold">時間帯別の成約（件）</h2>
            <Bars data={s.hourly.slice(10, 24).map((v, i) => ({ label: `${i + 10}`, value: v }))} />
            <p className="mt-2 text-[11.5px] text-muted">受取が集中する時間に合わせて、出品時刻や受取時間を調整できます。</p>
          </div>
          <div className="card p-5">
            <h2 className="mb-3 text-[15px] font-bold">商品別</h2>
            {s.products.length === 0 ? (
              <p className="text-[13px] text-muted">この月の成約はまだありません。</p>
            ) : (
              <table className="w-full text-[13px]">
                <tbody>
                  {s.products.map((p) => (
                    <tr key={p.name} className="border-b border-line last:border-0">
                      <td className="py-2">{p.name}</td>
                      <td className="tnum py-2 text-right text-muted">{p.count}点</td>
                      <td className="tnum py-2 text-right font-semibold">{yen(p.gmv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : (
        <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-[15px] font-bold">時間帯別・商品別の分析は STANDARD プランで</h2>
            <p className="mt-1 text-[13px] text-muted">
              月額 {yen(PLANS.standard.monthlyFee)}・成約手数料 {PLANS.standard.commissionBps / 100}%。AI値引き提案・自動再出品・優先掲載も使えます。
            </p>
          </div>
          <ButtonLink href="/store/settings#plan" variant="dark">
            プランを見る
          </ButtonLink>
        </section>
      )}
    </div>
  );
}
