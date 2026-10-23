import { Clock, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuyForm } from "@/components/forms/BuyForm";
import { ProductVisual } from "@/components/product/ProductVisual";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Section";
import { nowMs } from "@/lib/clock";
import { features } from "@/lib/features";
import { chargeNote } from "@/lib/purchase";
import { PRICING } from "@/lib/fees";
import { pickupLabel } from "@/lib/format";
import { requireViewer } from "@/server/auth/viewer";
import { getProductDetail } from "@/server/services/catalog";
import { isProductPurchasable } from "@/server/services/payments";
import { cancellationSummary, getPolicySettings } from "@/server/services/settings";
import Link from "next/link";

export const metadata: Metadata = { title: "購入の確認" };

/** v2 購入確認（オンライン事前決済）。旧フローの予約確認（/products/[id]/reserve）とは別のページ。 */
export default async function BuyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer(`/products/${id}/buy`);
  const data = await getProductDetail(viewer.id, id);
  if (!data) notFound();
  const { product, store } = data;
  const available =
    store.status === "active" && product.status === "published" && product.remaining > 0 && Date.parse(product.pickupEndAt) > nowMs();
  const open = features.v2CheckoutOpen;
  const purchasable = open && available && (await isProductPurchasable(viewer.id, product.id));
  const max = Math.min(product.maxPerReservation, product.remaining);
  const policy = await getPolicySettings();

  return (
    <div className="space-y-5">
      <h1 className="text-[20px] font-bold">購入の確認</h1>

      <div className="flex gap-3 rounded-2xl border border-line p-3">
        <ProductVisual imageUrl={product.imageUrl} category={product.category} alt={product.name} sizes="80px" className="aspect-square w-20 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p className="text-[12px] text-muted">{store.name}</p>
          <p className="text-[15px] font-bold leading-snug">{product.name}</p>
          <p className="tnum mt-1 text-[13px]">
            食べつなぎ価格 <span className="font-semibold">{product.rescuePrice.toLocaleString("ja-JP")}円</span>
          </p>
        </div>
      </div>

      <dl className="space-y-3 rounded-2xl bg-canvas px-4 py-4 text-[14px]">
        <div className="flex gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          <div>
            <dt className="text-[12px] text-muted">受取時間</dt>
            <dd className="tnum font-bold">{pickupLabel(product.pickupStartAt, product.pickupEndAt)}</dd>
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

      <section>
        <h2 className="mb-2 text-[13px] font-bold">ご確認ください</h2>
        <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-ink-2">
          <li>・お支払いはオンライン（事前決済）です。お店でのお会計はありません。</li>
          <li>・つなぐチャージ（{PRICING.tsunaguCharge}円）は、1回のご注文ごとにかかるシステム利用料です。{chargeNote.points}</li>
          <li data-testid="cancellation-note">
            ・{cancellationSummary(policy)}
            <Link href="/cancellation-policy" className="ml-1 underline">
              キャンセルポリシー
            </Link>
          </li>
          {product.isBox && <li>・食べつなぎBOXの中身は当日のお楽しみです。アレルギーなどはお店に直接ご確認ください。</li>}
        </ul>
      </section>

      {purchasable ? (
        <BuyForm
          productId={product.id}
          unitPrice={product.rescuePrice}
          tsunaguCharge={PRICING.tsunaguCharge}
          pointsNote={chargeNote.points}
          max={max}
          unit={product.isBox ? "BOX" : "点"}
        />
      ) : (
        <div className="space-y-3">
          <Notice tone="error">
            {!open
              ? "現在オンラインでの購入は準備中です。"
              : available
                ? "現在この店舗の商品は購入できません。"
                : "この商品は現在、購入を受け付けていません。"}
          </Notice>
          <ButtonLink href="/products" variant="secondary" size="lg" className="w-full">
            ほかの商品をさがす
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
