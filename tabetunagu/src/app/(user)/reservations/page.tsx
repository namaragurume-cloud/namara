import type { Metadata } from "next";
import Link from "next/link";
import { ProductVisual } from "@/components/product/ProductVisual";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/Section";
import { ReservationStatusBadge } from "@/components/ui/StatusBadge";
import { pickupLabel } from "@/lib/format";
import { requireViewer } from "@/server/auth/viewer";
import { hasMyOrders } from "@/server/services/pickup";
import { listMyReservations, type ReservationTab } from "@/server/services/reservations";

export const metadata: Metadata = { title: "予約" };

const TABS: { id: ReservationTab; label: string }[] = [
  { id: "upcoming", label: "今後の予約" },
  { id: "past", label: "過去の食べつなぎ" },
  { id: "cancelled", label: "キャンセル" },
];

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab = (TABS.find((t) => t.id === rawTab)?.id ?? "upcoming") as ReservationTab;
  const viewer = await requireViewer("/reservations");
  const [items, showOrders] = await Promise.all([listMyReservations(viewer.id, tab), hasMyOrders(viewer.id)]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-[20px] font-bold">予約</h1>
        {showOrders && (
          <Link href="/orders" className="text-[12.5px] font-semibold text-forest underline-offset-2 hover:underline">
            事前決済の注文はこちら
          </Link>
        )}
      </div>
      <div className="grid grid-cols-3 rounded-full bg-canvas p-1 text-[12.5px] font-semibold" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/reservations?tab=${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            className={cn("rounded-full py-2 text-center", tab === t.id ? "bg-paper text-ink shadow-sm" : "text-muted")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={tab === "upcoming" ? "今後の予約はありません" : tab === "past" ? "まだ食べつなぎの記録はありません" : "キャンセルした予約はありません"}
          body={tab === "upcoming" ? "今日のおいしさを、次の人へ。近くのお店をのぞいてみましょう。" : undefined}
          action={tab === "upcoming" ? <ButtonLink href="/products">商品をさがす</ButtonLink> : undefined}
        />
      ) : (
        <ul className="space-y-2.5">
          {items.map((r) => (
            <li key={r.id}>
              <Link href={r.status === "completed" ? `/done/${r.id}` : `/reservations/${r.id}`} className="flex gap-3 rounded-2xl border border-line p-2.5 hover:bg-canvas">
                <ProductVisual imageUrl={r.productImageUrl} category={r.category} alt={r.productName} sizes="64px" className="aspect-square w-16 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[12px] text-muted">{r.storeName}</p>
                    <ReservationStatusBadge status={r.status} pickupEndAt={r.pickupEndAt} />
                  </div>
                  <p className="truncate text-[14px] font-bold">{r.productName}</p>
                  <p className="tnum mt-0.5 text-[12px] text-ink-2">
                    {pickupLabel(r.pickupStartAt, r.pickupEndAt)}・{r.totalPrice.toLocaleString("ja-JP")}円
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
