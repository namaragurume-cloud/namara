import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeaturedDemoForm } from "@/components/admin/FeaturedDemoForm";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { ProductVisual } from "@/components/product/ProductVisual";
import { dateTime } from "@/lib/format";
import { featuredCard } from "@/lib/featured-message";
import { requireAdmin } from "@/server/auth/viewer";
import { env } from "@/server/env";
import { getFeaturedProduct, listFeaturableProducts, recentPushLogs } from "@/server/services/line-marketing";

export const metadata: Metadata = { title: "LINE 注目商品デモ" };

const STATUS: Record<string, string> = { sent: "送信済み", failed: "失敗", skipped: "送信せず" };

/**
 * 「今日の食べつなぎ」（注目商品）のテスト送信（管理者・開発／プレビュー環境のみ。本番では表示しない）。
 * LINE 公式アカウント（Messaging API の Push）から、ログイン中の自分の LINE にだけ1件送る。自動配信・Broadcast はしない。
 */
export default async function LineFeaturedDemoPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const viewer = await requireAdmin("/admin/line-featured-demo");
  if (!env.line.marketingDemoEnabled) notFound();
  const { product: productId } = await searchParams;
  const [products, product, logs] = await Promise.all([
    listFeaturableProducts(),
    productId ? getFeaturedProduct(productId) : Promise.resolve(null),
    recentPushLogs(viewer.id),
  ]);
  const card = product ? featuredCard(product, { liffId: env.line.liffId, appUrl: env.appUrl, now: new Date() }) : null;

  return (
    <div className="max-w-2xl space-y-6" data-testid="line-featured-demo">
      <PageHeader
        title="LINE 注目商品デモ（LINE 公式アカウント）"
        sub="選んだ商品を「今日の食べつなぎ」として、ログイン中の自分の LINE にだけ送ります。ほかのユーザーには送りません。"
      />
      <section className="card space-y-1.5 p-5 text-[13px]">
        <p>
          LINE でログインしたアカウント：<span className="font-semibold">{viewer.lineLinked ? "はい" : "いいえ（送信できません）"}</span>
        </p>
        <p>
          LINE 公式アカウントのアクセストークン：<span className="font-semibold">{env.line.messagingAccessToken ? "設定済み" : "未設定"}</span>
        </p>
        <p className="text-[12px] text-muted">受け取るには、TABETUNAGU の LINE 公式アカウントを友だち追加しておく必要があります。</p>
      </section>

      <form method="get" className="card flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-0 flex-1">
          <label htmlFor="product" className="label">
            商品を選ぶ（公開中）
          </label>
          <select id="product" name="product" defaultValue={productId ?? ""} className="field" data-testid="featured-demo-select">
            <option value="">選んでください</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <button className="h-11 rounded-full border border-line bg-paper px-5 text-[14px] font-semibold">プレビュー</button>
      </form>

      {productId && !card && <p className="text-[13px] text-clay">公開中の商品が見つかりません。別の商品を選んでください。</p>}
      {card && product && (
        <section className="space-y-4">
          <h2 className="text-[15px] font-bold">プレビュー</h2>
          <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl border border-line bg-white shadow-sm" data-testid="featured-demo-preview">
            <ProductVisual imageUrl={product.imageUrl} category="other" alt="" sizes="300px" className="aspect-[20/13] w-full" />
            <div className="space-y-1 p-4">
              <p className="text-[11px] font-bold text-forest">{card.title}</p>
              <p className="text-[13px] text-ink-2">{card.storeName}</p>
              <p className="text-[17px] font-bold leading-snug">{card.productName}</p>
              <p className="tnum text-[15px] font-bold">
                {card.priceLine}
                {card.discount && <span className="ml-2 text-[13px] text-forest">{card.discount}</span>}
              </p>
              <p className="tnum text-[13px] text-ink-2">
                {card.remaining}・受取 {card.pickup}
              </p>
            </div>
            <div className="px-4 pb-4">
              <span className="flex h-11 items-center justify-center rounded-lg bg-forest text-[14px] font-bold text-white">{card.ctaLabel}</span>
            </div>
          </div>
          <p className="break-all text-[11.5px] text-muted" data-testid="featured-demo-cta-url">
            「{card.ctaLabel}」のリンク先：{card.ctaUrl}
          </p>
          {!card.imageUrl && <p className="text-[11.5px] text-muted">この商品の画像は LINE のカードで使えない形式（JPEG / PNG 以外など）のため、画像なしで送ります。</p>}
          <div className="card p-5">
            <FeaturedDemoForm productId={product.id} />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-[15px] font-bold">直近の送信記録</h2>
        {logs.length === 0 ? (
          <p className="text-[13px] text-muted">まだ送信していません。</p>
        ) : (
          <ul className="card divide-y divide-line text-[13px]">
            {logs.map((l, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="tnum">{dateTime(l.created_at as unknown as string)}</span>
                <span className="min-w-0 truncate">{l.product_name ?? "（削除された商品）"}</span>
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
