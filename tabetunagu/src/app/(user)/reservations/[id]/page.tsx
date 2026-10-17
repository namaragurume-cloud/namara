import { CircleCheck, Clock, MapPin, QrCode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelReservationButton } from "@/components/forms/CancelReservationButton";
import { ProductVisual } from "@/components/product/ProductVisual";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Section";
import { ReservationStatusBadge } from "@/components/ui/StatusBadge";
import { CHECKIN_EARLY_MINUTES } from "@/lib/constants";
import { dateTime, pickupLabel } from "@/lib/format";
import { requireViewer } from "@/server/auth/viewer";
import { getMyReservation } from "@/server/services/reservations";
import { nowMs } from "@/lib/clock";

export const metadata: Metadata = { title: "予約詳細" };

export default async function ReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const viewer = await requireViewer(`/reservations/${id}`);
  const r = await getMyReservation(viewer.id, id);
  if (!r) notFound();
  const active = (r.status === "confirmed" || r.status === "pending") && Date.parse(r.pickupEndAt) > nowMs();
  const unit = r.isBox ? "BOX" : "点";

  return (
    <div className="space-y-5">
      {isNew && active ? (
        <div className="pt-2 text-center">
          <CircleCheck className="anim-ring mx-auto h-12 w-12 text-forest" strokeWidth={1.6} aria-hidden />
          <h1 className="mt-3 text-[22px] font-bold">予約が完了しました</h1>
          <p className="mt-1 text-[13px] text-muted">受取時間にお店でお待ちしています。</p>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-bold">予約詳細</h1>
          <ReservationStatusBadge status={r.status} pickupEndAt={r.pickupEndAt} />
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex gap-3 p-3">
          <ProductVisual imageUrl={r.productImageUrl} category={r.category} alt={r.productName} sizes="72px" className="aspect-square w-[72px] shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="text-[12px] text-muted">{r.storeName}</p>
            <p className="text-[15px] font-bold leading-snug">{r.productName}</p>
            <p className="tnum mt-0.5 text-[12.5px] text-ink-2">
              {r.quantity}
              {unit}・お店でのお支払い {r.totalPrice.toLocaleString("ja-JP")}円
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-line">
          <div className="border-r border-line px-4 py-3">
            <p className="text-[11px] text-muted">予約番号</p>
            <p className="tnum text-[22px] font-semibold tracking-[0.12em]">{r.code}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] text-muted">受取時間</p>
            <p className="tnum text-[14px] font-bold leading-snug">{pickupLabel(r.pickupStartAt, r.pickupEndAt)}</p>
          </div>
        </div>
      </div>

      {active && (
        <section className="rounded-2xl bg-forest px-5 py-5 text-white">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5" aria-hidden />
            <p className="text-[15px] font-bold">店舗に着いたらQRを読み取ってください</p>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/80">
            レジ付近の「TABETUNAGU」QRコードを読み取ると食べつなぎ完了。そのあと、お店の通常のレジでお支払いください。受取開始の
            {CHECKIN_EARLY_MINUTES}分前から読み取れます。
          </p>
          <ButtonLink href="/checkin" variant="secondary" size="lg" className="mt-4 w-full border-transparent">
            QRを読み取る
          </ButtonLink>
        </section>
      )}

      {r.status === "completed" && (
        <Notice tone="success">
          {dateTime(r.completedAt)} に食べつなぎ完了しました。
          <Link href={`/done/${r.id}`} className="ml-1 font-semibold underline underline-offset-4">
            完了画面を見る
          </Link>
        </Notice>
      )}
      {r.status === "cancelled" && (
        <Notice>
          {r.cancelledBy === "store" ? `お店の都合によりキャンセルされました。${r.cancelReason ? `（${r.cancelReason}）` : ""}` : "この予約はキャンセルしました。"}
        </Notice>
      )}

      <dl className="space-y-2.5 text-[13px]">
        <div className="flex gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
          <dd>
            <Link href={`/stores/${r.storeSlug}`} className="font-semibold">
              {r.storeName}
            </Link>
            {r.storeAddress && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.storeAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-muted underline decoration-line underline-offset-4"
              >
                {r.storeAddress}
              </a>
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
          <dd className="text-muted">予約日時 {dateTime(r.createdAt)}</dd>
        </div>
      </dl>
      {r.storePickupNote && <p className="rounded-xl bg-canvas px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">{r.storePickupNote}</p>}

      {active && <CancelReservationButton reservationId={r.id} />}

      <div className="flex justify-center pt-2">
        <Link href="/reservations" className="text-[13px] font-semibold text-forest">
          予約一覧へ
        </Link>
      </div>
    </div>
  );
}
