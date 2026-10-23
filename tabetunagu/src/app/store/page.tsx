import { Copy, Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { OneTapPublish } from "@/components/store/OneTapPublish";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, Notice, Stat } from "@/components/ui/Section";
import { ProductStatusBadge } from "@/components/ui/StatusBadge";
import { features } from "@/lib/features";
import { BREAK_EVEN_GMV, PLANS } from "@/lib/fees";
import { hhmm, percent, yen } from "@/lib/format";
import { requireStoreMember } from "@/server/auth/viewer";
import { getStoreDashboard } from "@/server/services/store";
import { getStoreReadiness } from "@/server/services/readiness";
import { getStoreOrderSales } from "@/server/services/v2-metrics";
import { ReadinessCard } from "@/components/store/ReadinessCard";
import { V2StoreDashboard } from "@/components/store/V2StoreDashboard";
import { logEvent } from "@/server/services/events";
import { getStoreOps } from "@/server/services/store-ops";

export default async function StoreDashboardPage({ searchParams }: { searchParams: Promise<{ published?: string }> }) {
  const { published } = await searchParams;
  const { viewer, store } = await requireStoreMember("/store");
  const v2 = features.v2Journey;
  if (v2) {
    // v2 の店舗ダッシュボード（商品・注文・売上・導入準備をまとめて取得。店舗ごとの個別クエリはしない）
    const [d, readinessMap, ops] = await Promise.all([
      getStoreDashboard(viewer.id, store.storeId),
      getStoreReadiness([store.storeId]),
      getStoreOps(viewer.id, store.storeId),
    ]);
    await logEvent("store_dashboard_viewed", { userId: viewer.id, storeId: store.storeId, properties: { role: store.role } });
    return <V2StoreDashboard store={store} d={d} ops={ops} readiness={readinessMap.get(store.storeId)} published={Boolean(published)} />;
  }
  // v2 がメインのときは、今日・今月の数字を事前決済の注文（paid 基準）で出す。旧フローの予約の数字は「売上・手数料」の「以前の方式の実績」へ
  const [d, readinessMap, orders] = await Promise.all([
    getStoreDashboard(viewer.id, store.storeId),
    getStoreReadiness([store.storeId]),
    v2 ? getStoreOrderSales(viewer.id, store.storeId) : null,
  ]);
  const readiness = readinessMap.get(store.storeId);
  const fee = d.month.fee;
  const plan = PLANS[d.store.plan];

  return (
    <div className="space-y-8">
      <PageHeader title="ダッシュボード" sub={`${d.store.name}・今日の状況`} />

      {published && <Notice tone="success">出品しました。ユーザーの一覧に表示されています。</Notice>}
      {d.store.status !== "active" && (
        <Notice tone="error">
          {d.store.status === "pending"
            ? "店舗は審査中です。運営が確認後に公開されます（出品の準備はできます）。"
            : "店舗は停止中です。商品はユーザーに表示されません。"}
        </Notice>
      )}

      {readiness && <ReadinessCard readiness={readiness} />}

      <section className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
        <div className="card p-5">
          <h2 className="text-[15px] font-bold">出品する</h2>
          <p className="mt-1 text-[12.5px] text-muted">いつもの内容なら、ワンタップで今日の出品ができます。</p>
          <div className="mt-4 space-y-2">
            {d.templates.slice(0, 3).map((t) => (
              <OneTapPublish
                key={t.id}
                storeId={store.storeId}
                templateId={t.id}
                label={`いつもの「${t.name}」を出品`}
                detail={`本日 ${t.pickupStart}〜${t.pickupEnd}・${t.quantity}${t.isBox ? "BOX" : "点"}・${t.rescuePrice.toLocaleString("ja-JP")}円`}
              />
            ))}
            <div className="grid grid-cols-2 gap-2">
              {d.lastProduct && (
                <ButtonLink href={`/store/products/new?from=${d.lastProduct.id}`} variant="secondary" className="h-12 rounded-2xl">
                  <Copy className="h-4 w-4" aria-hidden />
                  前回と同じ内容で
                </ButtonLink>
              )}
              <ButtonLink href="/store/products/new" className={d.lastProduct ? "h-12 rounded-2xl" : "col-span-2 h-12 rounded-2xl"}>
                <Plus className="h-4 w-4" aria-hidden />
                新しく出品
              </ButtonLink>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-[15px] font-bold">今月（{d.month.label}）</h2>
          {orders ? (
            <>
              <dl className="mt-3 space-y-2 text-[13.5px]">
                <div className="flex justify-between">
                  <dt className="text-muted">注文件数</dt>
                  <dd className="tnum font-semibold">{orders.month.orders}件</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">月間売上</dt>
                  <dd className="tnum font-semibold">{yen(orders.month.sales)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">受取完了 / 未受取</dt>
                  <dd className="tnum font-semibold">
                    {orders.month.pickedUp}件 / {orders.month.unclaimed}件
                  </dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <dt className="text-muted">
                    TABETUNAGU 手数料（{plan.name}）
                    <span className="block text-[11px]">
                      {plan.monthlyFee > 0 ? `月額 ${yen(plan.monthlyFee)} + ` : ""}売上 × {plan.commissionBps / 100}%
                    </span>
                  </dt>
                  <dd className="tnum text-[18px] font-semibold">{yen(plan.monthlyFee + orders.month.commission)}</dd>
                </div>
              </dl>
              {d.store.plan === "free" && orders.month.sales > BREAK_EVEN_GMV * 0.8 && (
                <p className="mt-3 rounded-xl bg-leaf-soft px-3 py-2 text-[12px] text-forest">
                  月間売上が {yen(BREAK_EVEN_GMV)} を超えると STANDARD のほうがお得です。
                </p>
              )}
            </>
          ) : (
            <>
              <dl className="mt-3 space-y-2 text-[13.5px]">
                <div className="flex justify-between">
                  <dt className="text-muted">成約件数</dt>
                  <dd className="tnum font-semibold">{d.month.completedCount}件</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">月間成約額（GMV）</dt>
                  <dd className="tnum font-semibold">{yen(fee.gmv)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">QR完了率</dt>
                  <dd className="tnum font-semibold">{percent(d.month.qrRate)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <dt className="text-muted">
                    TABETUNAGU 手数料（{plan.name}）
                    <span className="block text-[11px]">
                      {plan.monthlyFee > 0 ? `月額 ${yen(plan.monthlyFee)} + ` : ""}成約売上 × {plan.commissionBps / 100}%
                    </span>
                  </dt>
                  <dd className="tnum text-[18px] font-semibold">{yen(fee.total)}</dd>
                </div>
              </dl>
              {d.store.plan === "free" && fee.gmv > BREAK_EVEN_GMV * 0.8 && (
                <p className="mt-3 rounded-xl bg-leaf-soft px-3 py-2 text-[12px] text-forest">
                  月間成約額が {yen(BREAK_EVEN_GMV)} を超えると STANDARD のほうがお得です。
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-bold">今日</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="本日の出品" value={`${d.today.listings}件`} />
          {orders ? (
            <>
              <Stat label="本日の注文" value={`${orders.today.orders}件`} />
              <Stat label="本日の売上" value={yen(orders.today.sales)} />
              <Stat label="残数" value={d.today.remaining} />
            </>
          ) : (
            <>
              <Stat label="予約数" value={`${d.today.reserved}件`} sub={`来店待ち ${d.today.waiting}件`} />
              <Stat label="残数" value={d.today.remaining} />
              <Stat label="食べつなぎ完了" value={`${d.today.completed}件`} />
              <Stat label="キャンセル" value={`${d.today.cancelled}件`} />
            </>
          )}
          <Stat label="お気に入り登録" value={`${d.favoriteCount}人`} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">本日の出品</h2>
          <Link href={v2 ? "/store/monitor" : "/store/reservations"} className="text-[13px] font-semibold text-forest">
            {v2 ? "受取モニターを見る" : "予約状況を見る"}
          </Link>
        </div>
        {d.todayProducts.length === 0 ? (
          <EmptyState title="今日はまだ出品していません" body="閉店前の余りそうな商品を、いつもの内容でワンタップ出品できます。" />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="text-left text-[12px] text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 font-semibold">商品</th>
                  <th className="px-3 py-2.5 font-semibold">受取時間</th>
                  <th className="px-3 py-2.5 text-right font-semibold">価格</th>
                  <th className="px-3 py-2.5 text-right font-semibold">残数 / 数量</th>
                  {v2 ? (
                    <th className="px-3 py-2.5 text-right font-semibold">販売数</th>
                  ) : (
                    <>
                      <th className="px-3 py-2.5 text-right font-semibold">来店待ち</th>
                      <th className="px-3 py-2.5 text-right font-semibold">完了</th>
                    </>
                  )}
                  <th className="px-4 py-2.5 font-semibold">状態</th>
                </tr>
              </thead>
              <tbody>
                {d.todayProducts.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/store/products/${p.id}`} className="font-semibold hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="tnum px-3 py-3">
                      {hhmm(p.pickupStartAt)}〜{hhmm(p.pickupEndAt)}
                    </td>
                    <td className="tnum px-3 py-3 text-right">{yen(p.rescuePrice)}</td>
                    <td className="tnum px-3 py-3 text-right">
                      <span className="font-semibold">{p.remaining}</span> / {p.quantity}
                    </td>
                    {v2 ? (
                      <td className="tnum px-3 py-3 text-right">{p.quantity - p.remaining}</td>
                    ) : (
                      <>
                        <td className="tnum px-3 py-3 text-right">{p.activeCount}</td>
                        <td className="tnum px-3 py-3 text-right">{p.completedCount}</td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <ProductStatusBadge status={p.status} pickupEndAt={p.pickupEndAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[12px] text-muted">
          {v2
            ? "お支払いはお客様がオンラインで済ませています。お客様がご自身で受取チケットをスワイプすると、受取モニターに受取完了が表示されます（店舗側の完了操作は不要です）。"
            : "成約（食べつなぎ完了）は、お客様が店頭のQRを読み取ると自動で記録されます。お会計はいつものレジでお願いします。"}
        </p>
      </section>
    </div>
  );
}
