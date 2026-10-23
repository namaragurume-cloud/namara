import { ChevronRight, CircleCheck, CircleDashed, Copy, MonitorSmartphone, Plus } from "lucide-react";
import Link from "next/link";
import { OneTapPublish } from "@/components/store/OneTapPublish";
import { ProductStatusBadge } from "@/components/ui/StatusBadge";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Notice } from "@/components/ui/Section";
import { hhmm, yen } from "@/lib/format";
import { planView, standardHint, storeAlerts, storeNetEstimate } from "@/lib/store-dashboard";
import type { Membership } from "@/server/auth/viewer";
import type { getStoreDashboard } from "@/server/services/store";
import type { StoreOnboarding } from "@/server/services/onboarding";
import type { StoreOps } from "@/server/services/store-ops";

type Dashboard = Awaited<ReturnType<typeof getStoreDashboard>>;

/**
 * v2（事前決済）の店舗ダッシュボード。「次にやること」が分かる順に並べる:
 *   （準備が終わっていなければ「始める準備」）→ 今日の数字 + 出品 → これから受取（モニター）→ 本日の出品 → 今月の売上・プラン（オーナー）
 * スタッフには売上金額・プラン・売上受取設定を出さない。
 */
export function V2StoreDashboard({
  store,
  d,
  ops,
  onboarding,
  published,
}: {
  store: Membership;
  d: Dashboard;
  ops: StoreOps;
  onboarding: StoreOnboarding;
  published: boolean;
}) {
  const owner = store.role === "owner";
  const stripeReady = onboarding.steps.find((st) => st.key === "payout")?.done ?? false;
  const alerts = storeAlerts({
    stripeReady,
    upcomingPickups: ops.upcomingPickups,
    unclaimedYesterday: ops.unclaimedYesterday,
    productCount: ops.products.total,
    liveCount: ops.products.live,
    isOwner: owner,
  }).filter((a) => a.key !== "pickups"); // 受取予定は専用のカードで表示する
  const plan = planView(d.store.plan);
  const hint = standardHint(d.store.plan, ops.month.sales);

  return (
    <div className="space-y-6" data-testid="store-dashboard" data-role={store.role}>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold">今日のTABETUNAGU</h1>
          <p className="truncate text-[13px] text-ink-2">{d.store.name}</p>
          <p className="mt-1 text-[12.5px] font-semibold text-forest-2" data-testid="store-brand-copy">
            余ったら、出品するだけ。売れたら、渡すだけ。
          </p>
        </div>
        <div className="grid w-full grid-cols-[1fr_auto] gap-2 sm:flex sm:w-auto">
          <ButtonLink href="/store/products/new" size="lg" className="whitespace-nowrap" data-testid="store-cta-publish">
            <Plus className="h-5 w-5" aria-hidden />
            商品を出品する
          </ButtonLink>
          <ButtonLink href="/store/monitor" variant="secondary" size="lg" className="whitespace-nowrap px-4" aria-label="店舗モニターを開く">
            <MonitorSmartphone className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">店舗モニター</span>
            <span className="sm:hidden">モニター</span>
          </ButtonLink>
        </div>
      </section>

      {published && <Notice tone="success">出品しました。お客様の一覧に表示されています。</Notice>}
      {d.store.status !== "active" && (
        <Notice tone="error">
          {d.store.status === "pending"
            ? "店舗は審査中です。運営が確認後に公開されます（出品の準備はできます）。"
            : "店舗は停止中です。商品はお客様に表示されません。"}
        </Notice>
      )}

      {alerts.length > 0 && (
        <ul className="space-y-1.5" data-testid="store-alerts">
          {alerts.map((a) => (
            <li key={a.key}>
              <Link
                href={a.href}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold",
                  a.tone === "action" ? "bg-clay-soft text-clay" : "bg-canvas text-ink",
                )}
                data-testid={`store-alert-${a.key}`}
              >
                {a.text}
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!onboarding.progress.complete && (
        <section className="card border-2 border-forest p-4" data-testid="store-readiness" data-complete="no" aria-labelledby="onboarding-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="onboarding-title" className="text-[15px] font-bold">
              TABETUNAGU を始める準備
            </h2>
            <span className="tnum text-[15px] font-bold" data-testid="readiness-progress">
              {onboarding.progress.label}
            </span>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
            {onboarding.steps.map((st) => (
              <li key={st.key} className="flex items-center gap-1" data-testid={`readiness-item-${st.key}`} data-ok={st.done ? "yes" : "no"}>
                {st.done ? <CircleCheck className="h-4 w-4 text-forest" aria-hidden /> : <CircleDashed className="h-4 w-4 text-muted" aria-hidden />}
                <span className="sr-only">{st.done ? "完了" : "未完了"}：</span>
                {st.title}
              </li>
            ))}
          </ul>
          {onboarding.progress.next && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px]">
                次にやること：<span className="font-bold">{onboarding.progress.next.title}</span>
              </p>
              <ButtonLink href="/store/start" size="sm">
                続きから準備する
              </ButtonLink>
            </div>
          )}
        </section>
      )}

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="今日の状況">
        {owner && <Card label="今日の売上" value={yen(ops.today.sales)} testId="store-today-sales" strong />}
        <Card label="今日の注文" value={`${ops.today.orders}件`} testId="store-today-orders" strong={!owner} />
        <Link href="/store/monitor" className="block" data-testid="store-upcoming">
          <Card
            label="これから受取"
            value={`${ops.upcomingPickups}件`}
            sub={
              <span className="inline-flex items-center gap-0.5 font-semibold text-forest">
                受取モニターを見る
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            }
            strong
          />
        </Link>
        {owner ? (
          <Card label="今月の売上" value={yen(ops.month.sales)} sub={`${ops.month.orders}件`} testId="store-month-sales" />
        ) : (
          <Card label="公開中の商品" value={`${ops.products.live}件`} />
        )}
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-4">
          <section className="card p-5" aria-labelledby="quick-publish-title">
            <h2 id="quick-publish-title" className="text-[15px] font-bold">
              出品する
            </h2>
            {ops.products.total === 0 ? (
              <div className="mt-2 rounded-2xl bg-canvas px-4 py-5 text-center" data-testid="store-products-empty">
                <p className="text-[14px] font-semibold">まだ商品がありません。</p>
                <ButtonLink href="/store/products/new" className="mt-3">
                  最初の商品を出品する
                </ButtonLink>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {d.templates.slice(0, 3).map((t) => (
                  <OneTapPublish
                    key={t.id}
                    storeId={store.storeId}
                    templateId={t.id}
                    label={`いつもの「${t.name}」を出品`}
                    detail={`本日 ${t.pickupStart}〜${t.pickupEnd}・${t.quantity}${t.isBox ? "BOX" : "点"}・${t.rescuePrice.toLocaleString("ja-JP")}円`}
                  />
                ))}
                {d.lastProduct && (
                  <ButtonLink href={`/store/products/new?from=${d.lastProduct.id}`} variant="secondary" className="h-12 w-full rounded-2xl">
                    <Copy className="h-4 w-4" aria-hidden />
                    前回の「{d.lastProduct.name}」を複製して出品
                  </ButtonLink>
                )}
              </div>
            )}
          </section>

          <section className="card p-5" aria-labelledby="today-products-title">
            <div className="flex items-center justify-between gap-2">
              <h2 id="today-products-title" className="text-[15px] font-bold">
                本日の出品
              </h2>
              <Link href="/store/products" className="text-[13px] font-semibold text-forest">
                出品商品へ
              </Link>
            </div>
            {d.todayProducts.length === 0 ? (
              <p className="mt-2 text-[13px] text-ink-2">今日はまだ出品していません。</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {d.todayProducts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/store/products/${p.id}`} className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold">{p.name}</span>
                      <span className="tnum block text-[12px] text-ink-2">
                        {hhmm(p.pickupStartAt)}〜{hhmm(p.pickupEndAt)}・{yen(p.rescuePrice)}・残り {p.remaining}/{p.quantity}・売れた {p.quantity - p.remaining}
                      </span>
                    </Link>
                    <ProductStatusBadge status={p.status} pickupEndAt={p.pickupEndAt} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[12px] text-muted">
              お支払いはお客様がオンラインで済ませています。受取完了はお客様が操作し、受取モニターに表示されます。
            </p>
          </section>
        </div>

        <div className="min-w-0 space-y-4">
          {owner && (
            <section className="card p-5" data-testid="store-plan" aria-labelledby="store-plan-title">
              <div className="flex items-center justify-between gap-2">
                <h2 id="store-plan-title" className="text-[15px] font-bold">
                  今月の売上とプラン
                </h2>
                <span className="rounded-full bg-canvas px-2.5 py-0.5 text-[12px] font-bold" data-testid="store-plan-name">
                  {plan.name}
                </span>
              </div>
              {ops.month.orders === 0 ? (
                <p className="mt-2 text-[13px] text-ink-2" data-testid="store-sales-empty">
                  まだ売上はありません。商品を出品すると、ここに売上が表示されます。
                </p>
              ) : (
                <dl className="tnum mt-2 space-y-1.5 text-[13.5px]">
                  <Row label="売上" value={yen(ops.month.sales)} />
                  <Row label={`TABETUNAGU 手数料（${plan.commissionPercent}%）`} value={`− ${yen(ops.month.commission)}`} />
                  <Row label="店舗受取見込" value={yen(storeNetEstimate(ops.month.sales, ops.month.commission))} strong />
                </dl>
              )}
              <p className="mt-2 text-[11.5px] text-muted">
                現在のプラン {plan.name}：{plan.monthlyFee > 0 ? `月額 ${yen(plan.monthlyFee)} + ` : "月額 0円・"}成約手数料 {plan.commissionPercent}%（決済手数料込み）。
                受取見込は目安で、実際の入金日・金額は売上受取設定（Stripe）の入金スケジュールによります。
              </p>
              {hint && (
                <p className="mt-3 rounded-xl bg-leaf-soft px-3 py-2.5 text-[12.5px] text-forest-2" data-testid="store-standard-hint" data-kind={hint.kind}>
                  {hint.kind === "near"
                    ? `STANDARD がおトクになる目安（月 ${yen(hint.breakEven)}）まで、あと ${yen(hint.gap)} です。`
                    : `今月の売上では、STANDARD の方が手数料負担を抑えられる可能性があります（試算：FREE ${yen(hint.freeFee)} / STANDARD ${yen(hint.standardFee)}）。`}
                  <Link href="/store/settings#plan" className="ml-1 font-semibold underline">
                    プランを比べる
                  </Link>
                </p>
              )}
              <Link href="/store/sales" className="mt-3 inline-flex items-center text-[13px] font-semibold text-forest">
                売上の詳細
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </section>
          )}

          {onboarding.progress.complete && (
            <section className="card flex items-center justify-between gap-3 p-4" data-testid="store-readiness" data-complete="yes">
              <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                <CircleCheck className="h-5 w-5 text-forest" aria-hidden />
                導入準備 <span data-testid="readiness-progress">{onboarding.progress.label}</span>
              </span>
              <Link href="/store/start" className="text-[12.5px] font-semibold text-forest underline">
                再確認する
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, sub, testId, strong }: { label: string; value: string; sub?: React.ReactNode; testId?: string; strong?: boolean }) {
  return (
    <div className="card h-full px-4 py-3" data-testid={testId}>
      <p className="text-[12px] font-semibold text-ink-2">{label}</p>
      <p className={cn("tnum mt-0.5 font-bold leading-tight", strong ? "text-[26px]" : "text-[22px]")}>{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-muted">{sub}</p>}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong && "border-t border-line pt-1.5 text-[15px] font-bold")}>
      <dt className={strong ? "" : "text-ink-2"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
