import { Clock, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReserveForm } from "@/components/forms/ReserveForm";
import { ProductVisual } from "@/components/product/ProductVisual";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Section";
import { MAX_ACTIVE_RESERVATIONS } from "@/lib/constants";
import { pickupLabel } from "@/lib/format";
import { requireViewer } from "@/server/auth/viewer";
import { getProductDetail } from "@/server/services/catalog";
import { nowMs } from "@/lib/clock";

export const metadata: Metadata = { title: "予約の確認" };

export default async function ReservePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer(`/products/${id}/reserve`);
  const data = await getProductDetail(viewer.id, id);
  if (!data) notFound();
  const { product, store, myReservationId } = data;
  const available =
    store.status === "active" && product.status === "published" && product.remaining > 0 && Date.parse(product.pickupEndAt) > nowMs();
  const max = Math.min(product.maxPerReservation, product.remaining);

  return (
    <div className="space-y-5">
      <h1 className="text-[20px] font-bold">予約の確認</h1>

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
          <li>・お支払いはお店で。現金・カード・QR決済など、お店のいつもの方法でお支払いください（TABETUNAGU では決済しません）。</li>
          <li>・受取時間内にお店へ行き、店頭のQRコードを読み取ってください。読み取ると「食べつなぎ完了」になります。</li>
          <li>・キャンセルは受取終了時刻まで、予約詳細からできます。連絡なしの未来店が続くと、ご利用を制限する場合があります。</li>
          <li>・同時に予約できるのは{MAX_ACTIVE_RESERVATIONS}件までです。</li>
          {product.isBox && <li>・食べつなぎBOXの中身は当日のお楽しみです。アレルギーなどはお店に直接ご確認ください。</li>}
        </ul>
      </section>

      {myReservationId ? (
        <div className="space-y-3">
          <Notice>この商品はすでに予約しています。</Notice>
          <ButtonLink href={`/reservations/${myReservationId}`} variant="dark" size="lg" className="w-full">
            予約を確認する
          </ButtonLink>
        </div>
      ) : available ? (
        <ReserveForm productId={product.id} unitPrice={product.rescuePrice} max={max} unit={product.isBox ? "BOX" : "点"} />
      ) : (
        <div className="space-y-3">
          <Notice tone="error">この商品は現在、予約を受け付けていません。</Notice>
          <ButtonLink href="/products" variant="secondary" size="lg" className="w-full">
            ほかの商品をさがす
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
