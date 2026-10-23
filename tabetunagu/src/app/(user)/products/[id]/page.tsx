import { Clock, Leaf, MapPin, Package, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { FavoriteButton } from "@/components/forms/FavoriteButton";
import { DealRow } from "@/components/home/DealCard";
import { ProductVisual } from "@/components/product/ProductVisual";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Notice } from "@/components/ui/Section";
import { brand } from "@/lib/brand";
import { areaLabel } from "@/lib/categories";
import { nowMs } from "@/lib/clock";
import { discountOf, pickupDeadline, remainingLabel } from "@/lib/deals";
import { features } from "@/lib/features";
import { hhmm, pickupLabel } from "@/lib/format";
import { buyLabel, isLegacyPickupNote, PICKUP_STEPS, pointsNote, priceBreakdown, v2ProductCta } from "@/lib/purchase";
import { getViewer } from "@/server/auth/viewer";
import { getProductDetail } from "@/server/services/catalog";
import { logEvent } from "@/server/services/events";
import { cancellationSummary, getPolicySettings } from "@/server/services/settings";

type Props = { params: Promise<{ id: string }> };

/** 同じリクエストの中（メタデータと本文）では、商品・店舗を1回だけ読む */
const loadDetail = cache((viewerId: string | null, id: string) => getProductDetail(viewerId, id, { related: true }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const viewer = await getViewer();
  const data = await loadDetail(viewer?.id ?? null, id);
  return data ? { title: `${data.product.name}｜${data.store.name}`, description: data.product.description.slice(0, 120) } : {};
}

/**
 * 商品詳細。購入判断に必要な順（何が・どれくらいお得か・いくら払うか・いつ・残り・どこで・どうやって）に並べる。
 * v2（事前決済）では支払い合計・受け取り方・支払い合計入りの購入ボタンを出す。フラグ OFF では旧フロー（予約）の導線のまま。
 */
export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const viewer = await getViewer();
  const v2 = features.v2Journey;
  const [data, policy] = await Promise.all([loadDetail(viewer?.id ?? null, id), v2 ? getPolicySettings() : null]);
  if (!data) notFound();
  const { product, store, myReservationId, myOrderId, isFavorite, storePayable, related } = data;
  const now = nowMs();
  const nowDate = new Date(now);
  const cta = v2
    ? v2ProductCta({
        productId: product.id,
        status: product.status,
        remaining: product.remaining,
        pickupEndAt: product.pickupEndAt,
        storeActive: store.status === "active",
        storePayable,
        myOrderId,
        now,
      })
    : null;
  const ended = Date.parse(product.pickupEndAt) <= now || product.status === "closed";
  const soldOut = product.status === "sold_out" || product.remaining <= 0;
  const storeActive = store.status === "active";
  const discount = discountOf(product.originalPrice, product.rescuePrice);
  const deadline = ended ? null : pickupDeadline(product.pickupEndAt, nowDate);
  const remaining = remainingLabel(product.remaining, product.isBox);
  const breakdown = policy ? priceBreakdown(product.rescuePrice, policy.tsunaguChargeYen, policy.orderPoints) : null;
  const showBreakdown = breakdown && cta && cta.kind !== "ended" && cta.kind !== "sold_out";

  after(() => logEvent("product_view", { userId: viewer?.id, storeId: store.id, productId: product.id }));

  return (
    <div className="-mx-4 -mt-4">
      <div className="relative">
        <ProductVisual
          imageUrl={product.imageUrl}
          category={product.category}
          alt={product.name}
          sizes="(max-width: 640px) 100vw, 576px"
          priority
          dimmed={soldOut || ended}
          className="aspect-[16/10] w-full"
        />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {product.isBox ? <OverlayTag tone="dark">{brand.boxLabel}</OverlayTag> : <span />}
          {discount && (
            <OverlayTag tone="deal" testId="detail-discount">
              {discount.rate}%OFF
            </OverlayTag>
          )}
        </div>
      </div>

      <div className="space-y-4 px-4 pb-32 pt-3.5">
        <div>
          <Link href={`/stores/${store.slug}`} className="inline-flex min-h-[28px] items-center gap-1 text-[13px] font-semibold text-forest">
            <Store className="h-3.5 w-3.5" aria-hidden />
            {store.name}・{areaLabel(store.areaId)}
          </Link>
          <h1 className="mt-0.5 text-[20px] font-bold leading-snug">{product.name}</h1>
        </div>

        <section aria-label="価格" className="flex items-end justify-between gap-3" data-testid="detail-price">
          <p>
            <span className="block text-[10px] font-semibold tracking-[0.12em] text-forest">{brand.priceLabel}</span>
            <span className="tnum mt-1 block text-[34px] font-semibold leading-none text-ink">
              {product.rescuePrice.toLocaleString("ja-JP")}
              <span className="ml-0.5 text-[16px]">円</span>
            </span>
            {discount && <span className="tnum mt-1 block text-[13px] text-muted">{product.originalPrice.toLocaleString("ja-JP")}円相当</span>}
          </p>
          {discount && (
            <p className="flex shrink-0 flex-col items-end gap-1 text-[13px] font-bold">
              <span className="tnum rounded-full bg-forest px-2.5 py-1 text-white">{discount.rate}%OFF</span>
              <span className="tnum text-forest" data-testid="detail-saving">
                {discount.amount.toLocaleString("ja-JP")}円おトク
              </span>
            </p>
          )}
        </section>

        <dl className="grid grid-cols-2 gap-2" data-testid="detail-facts">
          <div className="rounded-2xl border border-line px-3 py-2.5">
            <dt className="flex items-center gap-1 text-[12px] font-semibold text-muted">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              受取時間
            </dt>
            <dd className="tnum mt-1 text-[15px] font-bold leading-tight" data-testid="detail-pickup">
              {pickupLabel(product.pickupStartAt, product.pickupEndAt, nowDate)}
            </dd>
            {deadline?.soon && (
              <dd className="tnum mt-1 text-[12px] font-bold text-clay" data-testid="detail-deadline">
                受取終了まで{deadline.label}
              </dd>
            )}
          </div>
          <div className="rounded-2xl border border-line px-3 py-2.5">
            <dt className="flex items-center gap-1 text-[12px] font-semibold text-muted">
              <Package className="h-3.5 w-3.5" aria-hidden />
              残り
            </dt>
            <dd className="mt-1" data-testid="detail-remaining">
              {ended ? (
                <span className="text-[16px] font-bold text-muted">受付終了</span>
              ) : soldOut || !remaining ? (
                <span className="text-[16px] font-bold text-muted">売り切れ</span>
              ) : (
                <span
                  className={cn(
                    "tnum text-[16px] font-bold",
                    remaining.last ? "rounded-full bg-clay-soft px-2 py-0.5 text-clay" : "text-forest",
                  )}
                >
                  {remaining.text}
                </span>
              )}
            </dd>
          </div>
        </dl>

        {!v2 && <p className="text-[12px] text-muted">受取時間内にお店へ。店頭のQRを読み取ってから、お会計です。</p>}

        {showBreakdown && breakdown && (
          <section className="rounded-2xl bg-canvas px-4 py-3.5" aria-label="お支払い" data-testid="price-breakdown">
            <dl className="space-y-1.5 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-ink-2">商品価格</dt>
                <dd className="tnum">{breakdown.subtotal.toLocaleString("ja-JP")}円</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">つなぐチャージ</dt>
                <dd className="tnum">{breakdown.tsunaguCharge.toLocaleString("ja-JP")}円</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-2">
                <dt className="font-bold">お支払い合計</dt>
                <dd className="tnum text-[20px] font-bold" data-testid="detail-total">
                  {breakdown.total.toLocaleString("ja-JP")}
                  <span className="ml-0.5 text-[12px]">円</span>
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-[12px] text-forest" data-testid="charge-note">
              {pointsNote(breakdown.tsunaguCharge, breakdown.points)}
            </p>
          </section>
        )}

        {cta?.kind === "not_ready" && <Notice>{cta.note}</Notice>}

        {v2 && policy && (
          <section aria-labelledby="pickup-howto" data-testid="pickup-guide">
            <h2 id="pickup-howto" className="text-[15px] font-bold">
              受け取り方
            </h2>
            <ol className="mt-2.5 space-y-2">
              {PICKUP_STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-2.5 text-[13px] text-ink-2">
                  <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-[12px] font-bold text-forest">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-2.5 text-[12px] text-muted">
              店頭でのお会計はありません。{cancellationSummary(policy)}
              <Link href="/cancellation-policy" className="ml-1 underline" data-testid="detail-cancellation">
                キャンセルポリシー
              </Link>
            </p>
          </section>
        )}

        {product.isBox && (
          <p className="rounded-xl bg-sand/60 px-4 py-3 text-[12.5px] leading-relaxed text-ink-2" data-testid="box-note">
            {discount && (
              <span className="tnum mb-1 block font-bold text-ink">
                {product.originalPrice.toLocaleString("ja-JP")}円相当 → {product.rescuePrice.toLocaleString("ja-JP")}円
              </span>
            )}
            {brand.boxLabel}の中身は当日のお楽しみです。アレルギーなどが気になる方は、お店に直接ご確認ください。
          </p>
        )}

        {product.description && (
          <section aria-labelledby="about-title">
            <h2 id="about-title" className="text-[15px] font-bold">
              商品について
            </h2>
            <p className="mt-2 whitespace-pre-line text-[14px] leading-[1.9] text-ink-2">{product.description}</p>
          </section>
        )}

        <section className="space-y-3 border-t border-line pt-5" aria-labelledby="store-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="store-title" className="text-[15px] font-bold">
              受取場所
            </h2>
            <FavoriteButton storeId={store.id} isFavorite={isFavorite} next={`/products/${product.id}`} />
          </div>
          <dl className="space-y-1.5 text-[13px]">
            <div className="flex gap-2">
              <dt className="sr-only">店舗</dt>
              <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
              <dd className="font-semibold">
                {store.name}（{areaLabel(store.areaId)}）
              </dd>
            </div>
            {store.address && (
              <div className="flex gap-2">
                <dt className="sr-only">住所</dt>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <dd>{store.address}</dd>
              </div>
            )}
            {store.openingHours && (
              <div className="flex gap-2">
                <dt className="sr-only">営業時間</dt>
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <dd>営業時間 {store.openingHours}</dd>
              </div>
            )}
          </dl>
          {store.pickupNote && !(v2 && isLegacyPickupNote(store.pickupNote)) && (
            <p className="rounded-xl bg-canvas px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">{store.pickupNote}</p>
          )}
          {store.description && <p className="text-[12.5px] leading-relaxed text-muted">{store.description}</p>}
        </section>

        {related.length > 0 && (
          <section aria-labelledby="related-title" data-testid="related">
            <h2 id="related-title" className="mb-2.5 text-[15px] font-bold">
              この店舗のほかの商品
            </h2>
            <div className="space-y-2.5">
              {related.map((p) => (
                <DealRow key={p.id} product={p} now={nowDate} />
              ))}
            </div>
          </section>
        )}

        <p className="flex items-center justify-center gap-1.5 text-center text-[12px] text-muted">
          <Leaf className="h-3.5 w-3.5 shrink-0 text-leaf" aria-hidden />
          この商品を食べつなぐことが、食品ロス削減にもつながります。
        </p>
      </div>

      <div
        className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-paper/95 backdrop-blur"
        data-testid="sticky-cta"
      >
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="tnum truncate text-[12px] text-ink-2">
              受取 {hhmm(product.pickupStartAt)}〜{hhmm(product.pickupEndAt)}
            </p>
            {cta?.kind === "buy" && breakdown ? (
              <p className="tnum mt-0.5 truncate text-[11px] font-semibold text-forest">{breakdown.points}pt付与</p>
            ) : (
              <p className="tnum mt-0.5 truncate text-[11px] text-muted">{product.rescuePrice.toLocaleString("ja-JP")}円</p>
            )}
          </div>
          {cta ? (
            cta.kind === "order" || cta.kind === "buy" ? (
              <ButtonLink
                href={cta.href}
                variant={cta.kind === "order" ? "dark" : "primary"}
                size="lg"
                className="min-w-[62%]"
                data-testid="product-cta"
              >
                {cta.kind === "buy" && breakdown ? buyLabel(breakdown.total) : cta.label}
              </ButtonLink>
            ) : (
              <span
                data-testid="product-cta"
                aria-disabled
                className="inline-flex h-14 min-w-[62%] items-center justify-center rounded-full bg-canvas px-6 text-[14px] font-semibold text-muted"
              >
                {cta.label}
              </span>
            )
          ) : myReservationId ? (
            <ButtonLink href={`/reservations/${myReservationId}`} variant="dark" size="lg" className="min-w-[56%]">
              予約を確認する
            </ButtonLink>
          ) : !storeActive || ended ? (
            <span className="inline-flex h-14 min-w-[56%] items-center justify-center rounded-full bg-canvas px-6 text-[14px] font-semibold text-muted">
              受付は終了しました
            </span>
          ) : soldOut ? (
            <span className="inline-flex h-14 min-w-[56%] items-center justify-center rounded-full bg-canvas px-6 text-[14px] font-semibold text-muted">
              すべてつながりました
            </span>
          ) : (
            <ButtonLink href={`/products/${product.id}/reserve`} size="lg" className="min-w-[56%]">
              {brand.cta}
            </ButtonLink>
          )}
        </div>
      </div>
    </div>
  );
}

function OverlayTag({ tone, testId, children }: { tone: "dark" | "deal"; testId?: string; children: React.ReactNode }) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "tnum inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-bold leading-none shadow-sm",
        tone === "dark" ? "bg-ink text-white" : "bg-forest text-white",
      )}
    >
      {children}
    </span>
  );
}
