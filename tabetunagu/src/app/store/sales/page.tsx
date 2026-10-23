import type { Metadata } from "next";
import Link from "next/link";
import { Bars } from "@/components/charts/Bars";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Notice, Stat } from "@/components/ui/Section";
import { PLANS } from "@/lib/fees";
import { percent, yen } from "@/lib/format";
import { parseSalesPeriod, SALES_PERIODS } from "@/lib/store-dashboard";
import { jstMonthRange } from "@/lib/time";
import { features } from "@/lib/features";
import { requireStoreMember } from "@/server/auth/viewer";
import { getStoreSales } from "@/server/services/store";
import { getStoreOps } from "@/server/services/store-ops";

export const metadata: Metadata = { title: "売上・手数料" };

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function StoreSalesPage({ searchParams }: { searchParams: Promise<{ month?: string; period?: string }> }) {
  const { month: raw, period: rawPeriod } = await searchParams;
  const { viewer, store } = await requireStoreMember("/store/sales");
  // 売上の詳細は店舗オーナーだけ（スタッフは注文・受取モニターを使う）
  if (store.role !== "owner") {
    return (
      <div className="space-y-4">
        <PageHeader title="売上・手数料" />
        <Notice>売上・手数料は店舗オーナーが確認できます。今日の注文は「注文（事前決済）」と「受取モニター」で確認できます。</Notice>
      </div>
    );
  }
  const month = jstMonthRange(raw).month;
  const period = parseSalesPeriod(rawPeriod);
  const [s, ops] = await Promise.all([getStoreSales(viewer.id, store.storeId, month), getStoreOps(viewer.id, store.storeId, period)]);
  const plan = PLANS[s.store.plan];
  const standard = s.store.plan === "standard";
  const v2Journey = features.v2Journey;

  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const dailyMap = new Map(s.daily.map((d) => [d.day, d]));
  const daily = Array.from({ length: days }, (_, i) => {
    const day = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { label: String(i + 1), value: dailyMap.get(day)?.gmv ?? 0 };
  });

  const legacySales = (
    <>
      <h2 className="text-[15px] font-bold">{v2Journey ? "成約（以前の方式）" : "店頭払い（旧フロー）の成約"}</h2>
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
              <dt className="text-muted">
                成約手数料（成約売上 {yen(s.fee.gmv)} × {plan.commissionBps / 100}%）
              </dt>
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

      {standard && (
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
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="売上・手数料"
        sub={
          v2Journey
            ? "オンライン事前決済の売上です。以前の方式の実績は、ページ下部にまとめています。"
            : "事前決済（オンライン）の売上と、店頭払い（旧フロー）の成約売上を分けて表示します。同じ取引が両方に入ることはありません。"
        }
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold">事前決済の売上</h2>
            <p className="text-[12px] text-muted">
              お支払いが完了した注文を売上として計上します（受取完了・未受取を含み、返金済み・お支払い待ちは含みません）。
            </p>
          </div>
          <nav className="flex gap-1 rounded-full bg-canvas p-1 text-[13px] font-semibold" aria-label="期間" data-testid="sales-period">
            {SALES_PERIODS.map((p) => (
              <Link
                key={p.id}
                href={`/store/sales?period=${p.id}`}
                aria-current={period === p.id ? "page" : undefined}
                className={cn("rounded-full px-3.5 py-1.5", period === p.id ? "bg-ink text-white" : "text-ink-2")}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        </div>
        {ops.period.orders === 0 && ops.period.refunded === 0 ? (
          <p className="card px-4 py-4 text-[13px] text-ink-2" data-testid="sales-empty">
            まだ売上はありません。商品を出品すると、ここに売上が表示されます。
          </p>
        ) : (
          <>
            <div className="card grid gap-4 p-5 md:grid-cols-[1fr_1.2fr]">
              <dl className="tnum space-y-1.5 text-[14px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-2">売上</dt>
                  <dd className="font-semibold" data-testid="sales-amount">{yen(ops.period.sales)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-2">TABETUNAGU 手数料（{plan.commissionBps / 100}%・決済手数料込み）</dt>
                  <dd data-testid="sales-commission">− {yen(ops.period.commission)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-line pt-1.5 text-[17px] font-bold">
                  <dt>店舗受取見込</dt>
                  <dd data-testid="sales-net">{yen(ops.period.storeNet)}</dd>
                </div>
              </dl>
              <p className="text-[12px] leading-relaxed text-muted">
                店舗受取見込は「売上 − 成約手数料」の目安です。実際の入金日・入金額は売上受取設定（Stripe）の入金スケジュールによって異なる場合があります。
                {plan.monthlyFee > 0 && ` STANDARD の月額 ${yen(plan.monthlyFee)} は含みません。`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Stat label="注文件数" value={`${ops.period.orders}件`} />
              <Stat label="受取完了" value={`${ops.period.pickedUp}件`} />
              <Stat label="未受取" value={`${ops.period.unclaimed}件`} sub="売上には含みます" />
              <Stat label="受取待ち" value={`${Math.max(0, ops.period.orders - ops.period.pickedUp - ops.period.unclaimed)}件`} />
              <Stat
                label="返金"
                value={`${ops.period.refunded}件`}
                sub={ops.period.refunded ? `${yen(ops.period.refundedAmount)}（売上に含めません）` : undefined}
              />
            </div>
          </>
        )}
      </section>

      {v2Journey ? (
        <details className="card p-5" data-testid="legacy-sales">
          <summary className="cursor-pointer text-[14px] font-bold">以前の方式の実績</summary>
          <div className="mt-4 space-y-6">{legacySales}</div>
        </details>
      ) : (
        legacySales
      )}

      {!standard && (
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
