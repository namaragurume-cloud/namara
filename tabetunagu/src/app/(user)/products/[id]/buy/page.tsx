import { Clock, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyForm, PaymentSummary, ResumeCheckoutForm, StickyBar } from "@/components/forms/BuyForm";
import { ProductVisual } from "@/components/product/ProductVisual";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Section";
import { brand } from "@/lib/brand";
import { nowMs } from "@/lib/clock";
import { pickupDeadline } from "@/lib/deals";
import { features } from "@/lib/features";
import { pickupLabel } from "@/lib/format";
import { AFTER_PAYMENT_STEPS, buyPageState, priceBreakdown } from "@/lib/purchase";
import { requireViewer } from "@/server/auth/viewer";
import { getProductDetail } from "@/server/services/catalog";
import { cancellationSummary, getPolicySettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "注文内容の確認" };

/**
 * v2 購入確認（オンライン事前決済）。旧フローの予約確認（/products/[id]/reserve）とは別のページ。
 * 何を・何個・いつ・どこで受け取り・いくら払い・キャンセル条件・決済後どうなるか、だけを確認して Stripe Checkout へ進む。
 * 購入できるかは注文作成時にサーバーで再確認する（在庫・受付終了・店舗の決済準備）。
 */
export default async function BuyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer(`/products/${id}/buy`);
  // 商品・店舗（決済可否を含む）・自分の注文は1回のトランザクションで、設定値は並行して読む
  const [data, policy] = await Promise.all([getProductDetail(viewer.id, id, { purchase: true }), getPolicySettings()]);
  if (!data) notFound();
  const { product, store, storePayable, myOrder } = data;
  const now = nowMs();
  const state = buyPageState({
    open: features.v2CheckoutOpen,
    status: product.status,
    remaining: product.remaining,
    pickupEndAt: product.pickupEndAt,
    storeActive: store.status === "active",
    storePayable,
    myOrder,
    now,
  });
  const max = Math.max(1, Math.min(product.maxPerReservation, product.remaining));
  const unit = product.isBox ? "BOX" : "点";
  const deadline = pickupDeadline(product.pickupEndAt, new Date(now));
  const single = priceBreakdown(product.rescuePrice, policy.tsunaguChargeYen, policy.orderPoints);

  const pickup = (
    <section className="rounded-2xl border border-line px-4 py-3.5" aria-labelledby="pickup-title" data-testid="buy-pickup">
      <h2 id="pickup-title" className="text-[13px] font-bold text-muted">
        受取
      </h2>
      <dl className="mt-2 space-y-2.5 text-[14px]">
        <div className="flex gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          <div>
            <dt className="text-[12px] text-muted">受取時間</dt>
            <dd className="tnum text-[17px] font-bold">{pickupLabel(product.pickupStartAt, product.pickupEndAt, new Date(now))}</dd>
            {deadline?.soon && <dd className="tnum text-[12px] font-bold text-clay">受取終了まで{deadline.label}</dd>}
          </div>
        </div>
        <div className="flex gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          <div>
            <dt className="text-[12px] text-muted">受取場所</dt>
            <dd className="font-bold">{store.name}</dd>
            {store.address && <dd className="text-[12px] text-muted">{store.address}</dd>}
          </div>
        </div>
      </dl>
    </section>
  );

  const details = (
    <>
      <section className="rounded-2xl border border-clay/25 bg-clay-soft/50 px-4 py-3" aria-labelledby="cancel-title" data-testid="cancellation-note">
        <h2 id="cancel-title" className="text-[13px] font-bold text-ink">
          キャンセルについて
        </h2>
        <p className="mt-1 text-[13px] text-ink-2">
          {cancellationSummary(policy)}
          <Link href="/cancellation-policy" className="ml-1 font-semibold underline">
            キャンセルポリシー
          </Link>
        </p>
      </section>

      <section aria-labelledby="after-title" data-testid="after-payment">
        <h2 id="after-title" className="text-[13px] font-bold text-muted">
          お支払いのあと
        </h2>
        <ol className="mt-2 space-y-1.5">
          {AFTER_PAYMENT_STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-2.5 text-[13px] text-ink-2">
              <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-[12px] font-bold text-forest">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      {product.isBox && <p className="text-[12px] text-muted">{brand.boxLabel}の中身は当日のお楽しみです。アレルギーなどはお店に直接ご確認ください。</p>}

      <p className="text-[11.5px] text-muted">
        お支払いは決済サービス Stripe の画面で行います。
        <Link href="/terms" className="mx-1 underline">
          利用規約
        </Link>
        と
        <Link href="/cancellation-policy" className="ml-1 underline">
          キャンセルポリシー
        </Link>
        をご確認のうえお進みください。
      </p>
    </>
  );

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[20px] font-bold">注文内容の確認</h1>
        <Link href={`/products/${product.id}`} className="inline-flex min-h-[44px] items-center text-[12.5px] font-semibold text-forest">
          商品に戻る
        </Link>
      </div>

      <section className="flex gap-3 rounded-2xl border border-line p-3" aria-label="ご注文の商品" data-testid="buy-product">
        <ProductVisual imageUrl={product.imageUrl} category={product.category} alt={product.name} sizes="80px" className="aspect-square w-20 shrink-0 rounded-xl" />
        <div className="min-w-0">
          {product.isBox && <span className="mb-1 inline-block rounded-full bg-ink px-2 py-0.5 text-[10.5px] font-bold text-white">{brand.boxLabel}</span>}
          <p className="text-[15px] font-bold leading-snug">{product.name}</p>
          <p className="text-[12px] text-muted">{store.name}</p>
          <p className="tnum mt-1 text-[13px]">
            {product.rescuePrice.toLocaleString("ja-JP")}円<span className="text-muted"> / 1{unit}</span>
          </p>
        </div>
      </section>

      {state.kind === "buy" ? (
        <BuyForm
          productId={product.id}
          unitPrice={product.rescuePrice}
          tsunaguCharge={policy.tsunaguChargeYen}
          orderPoints={policy.orderPoints}
          max={max}
          unit={unit}
          pickup={pickup}
          details={details}
        />
      ) : state.kind === "resume" ? (
        <>
          <Notice>お支払いが完了していないご注文があります。新しく注文せずに、そのまま決済を続けられます。</Notice>
          {pickup}
          <ResumeCheckoutForm orderId={state.orderId} total={state.total} />
          <Link href={`/orders/${state.orderId}`} className="block text-center text-[12.5px] font-semibold text-forest underline">
            注文の内容を見る・取り消す
          </Link>
        </>
      ) : state.kind === "ordered" ? (
        <>
          <Notice tone="success">この商品はすでにご注文済みです。</Notice>
          <StickyBar>
            <ButtonLink href={`/orders/${state.orderId}`} variant="dark" size="lg" className="w-full">
              注文を確認する
            </ButtonLink>
          </StickyBar>
        </>
      ) : (
        <>
          {pickup}
          {(state.kind === "not_ready" || state.kind === "closed") && (
            <PaymentSummary subtotal={single.subtotal} tsunaguCharge={single.tsunaguCharge} total={single.total} points={single.points} />
          )}
          <div role="status" data-testid="buy-unavailable">
            <Notice tone="error">{state.message}</Notice>
          </div>
          <ButtonLink href="/products" variant="secondary" size="lg" className="w-full">
            ほかの商品をさがす
          </ButtonLink>
          <StickyBar>
            <button
              type="button"
              disabled
              aria-disabled
              className="inline-flex h-14 w-full items-center justify-center rounded-full bg-canvas text-[15px] font-semibold text-muted"
              data-testid="buy-disabled"
            >
              {state.label}
            </button>
          </StickyBar>
        </>
      )}
    </div>
  );
}
