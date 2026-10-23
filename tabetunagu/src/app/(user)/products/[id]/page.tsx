import { Clock, MapPin, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { FavoriteButton } from "@/components/forms/FavoriteButton";
import { Remaining } from "@/components/product/ProductCard";
import { ProductVisual } from "@/components/product/ProductVisual";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { Notice } from "@/components/ui/Section";
import { brand } from "@/lib/brand";
import { areaLabel, categoryLabel } from "@/lib/categories";
import { hhmm, pickupLabel } from "@/lib/format";
import { getViewer } from "@/server/auth/viewer";
import { getProductDetail } from "@/server/services/catalog";
import { logEvent } from "@/server/services/events";
import { nowMs } from "@/lib/clock";
import { features } from "@/lib/features";
import { chargeNote, v2ProductCta } from "@/lib/purchase";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getProductDetail(null, id);
  return data ? { title: `${data.product.name}｜${data.store.name}`, description: data.product.description.slice(0, 120) } : {};
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const viewer = await getViewer();
  const data = await getProductDetail(viewer?.id ?? null, id);
  if (!data) notFound();
  const { product, store, myReservationId, myOrderId, isFavorite, storePayable } = data;
  const now = nowMs();
  const v2 = features.v2Journey;
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

  after(() => logEvent("product_view", { userId: viewer?.id, storeId: store.id, productId: product.id }));

  return (
    <div className="-mx-4 -mt-4">
      <ProductVisual
        imageUrl={product.imageUrl}
        category={product.category}
        alt={product.name}
        sizes="(max-width: 640px) 100vw, 576px"
        priority
        dimmed={soldOut || ended}
        className="aspect-[16/10] w-full"
      />
      <div className="space-y-5 px-4 pb-28 pt-4">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            {product.isBox && <Badge tone="dark">{brand.boxLabel}</Badge>}
            <Badge tone="sand">{categoryLabel(product.category)}</Badge>
            <Badge tone="outline">{areaLabel(store.areaId)}</Badge>
          </div>
          <h1 className="mt-2.5 text-[21px] font-bold leading-snug">{product.name}</h1>
          <Link href={`/stores/${store.slug}`} className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-forest">
            <Store className="h-3.5 w-3.5" aria-hidden />
            {store.name}
          </Link>
        </div>

        <div className="flex items-end justify-between rounded-2xl bg-canvas px-4 py-4">
          <Price price={product.rescuePrice} original={product.originalPrice} size="lg" />
          <Remaining product={product} className="text-[14px]" />
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-line px-4 py-3.5">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          <div>
            <p className="text-[12px] font-semibold text-muted">受取時間</p>
            <p className="tnum text-[17px] font-bold">{pickupLabel(product.pickupStartAt, product.pickupEndAt)}</p>
            <p className="mt-0.5 text-[12px] text-muted">
              {v2
                ? "お支払いは事前にオンラインで。受取時間内にお店で受取チケットを見せて、受け取りを完了してください。"
                : "受取時間内にお店へ。店頭のQRを読み取ってから、お会計です。"}
            </p>
          </div>
        </div>

        {cta?.kind === "not_ready" && <Notice>{cta.note}</Notice>}
        {v2 && (
          <p className="rounded-xl border border-line px-4 py-3 text-[12.5px] leading-relaxed text-ink-2" data-testid="charge-note">
            {chargeNote.short}
            <br />
            {chargeNote.points}
          </p>
        )}

        {product.description && <p className="whitespace-pre-line text-[14.5px] leading-[1.9] text-ink-2">{product.description}</p>}
        {product.isBox && (
          <p className="rounded-xl bg-sand/60 px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
            {v2 && product.originalPrice > product.rescuePrice && (
              <span className="tnum mb-1 block font-bold text-ink">
                {product.originalPrice.toLocaleString("ja-JP")}円相当 → {product.rescuePrice.toLocaleString("ja-JP")}円
              </span>
            )}
            食べつなぎBOXの中身は当日のお楽しみです。アレルギーなどが気になる方は、お店に直接ご確認ください。
          </p>
        )}

        <section className="space-y-3 border-t border-line pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-bold">{store.name}</h2>
            <FavoriteButton storeId={store.id} isFavorite={isFavorite} next={`/products/${product.id}`} />
          </div>
          {store.description && <p className="text-[13px] leading-relaxed text-muted">{store.description}</p>}
          <dl className="space-y-1.5 text-[13px]">
            {store.address && (
              <div className="flex gap-2">
                <dt className="sr-only">住所</dt>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <dd>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-line underline-offset-4"
                  >
                    {store.address}
                  </a>
                </dd>
              </div>
            )}
            {store.openingHours && (
              <div className="flex gap-2">
                <dt className="sr-only">営業時間</dt>
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <dd>{store.openingHours}</dd>
              </div>
            )}
          </dl>
          {store.pickupNote && <p className="rounded-xl bg-canvas px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">{store.pickupNote}</p>}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="tnum text-[18px] font-semibold leading-none">
              {product.rescuePrice.toLocaleString("ja-JP")}
              <span className="text-[11px]">円</span>
            </p>
            <p className="tnum mt-1 truncate text-[11px] text-muted">
              受取 {hhmm(product.pickupStartAt)}〜{hhmm(product.pickupEndAt)}
            </p>
          </div>
          {cta ? (
            cta.kind === "order" || cta.kind === "buy" ? (
              <ButtonLink href={cta.href} variant={cta.kind === "order" ? "dark" : "primary"} size="lg" className="min-w-[56%]" data-testid="product-cta">
                {cta.label}
              </ButtonLink>
            ) : (
              <span
                data-testid="product-cta"
                aria-disabled
                className="inline-flex h-14 min-w-[56%] items-center justify-center rounded-full bg-canvas px-6 text-[14px] font-semibold text-muted"
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
