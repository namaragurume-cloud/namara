import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { dateTime, pickupLabel, yen } from "@/lib/format";
import { displayStatus, ORDER_STATUS_LABEL, orderCta } from "@/lib/my-orders";
import type { OrderStatus } from "@/lib/orders";
import type { MyOrderCard } from "@/server/services/account";
import { ProductVisual } from "../product/ProductVisual";
import { cn } from "../ui/cn";

const STATUS_TONE: Record<OrderStatus, string> = {
  pending_payment: "border border-clay/40 bg-paper text-clay",
  paid: "bg-forest text-white",
  picked_up: "bg-leaf-soft text-forest-2",
  unclaimed: "bg-sand text-ink",
  refunded: "bg-canvas text-ink-2 border border-line",
  cancelled: "bg-canvas text-ink-2 border border-line",
};

/**
 * 注文カード（注文履歴・マイページ）。優先順: 状態 → 商品名 → 店舗 → 受取時間 → 金額。注文番号・注文日時は補助。
 * カード全体が状態に合った行き先（受取チケット・決済の再開・返金内容・注文詳細）へのリンク。
 */
export function OrderCard({ order: o, now }: { order: MyOrderCard; now: Date }) {
  const status = displayStatus(o, now);
  const cta = orderCta({ id: o.id, status, payable: o.payable });
  return (
    <Link
      href={cta.href}
      className="block rounded-2xl border border-line bg-paper p-3 hover:bg-canvas"
      data-testid="order-card"
      data-status={status}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", STATUS_TONE[status])} data-testid="order-status">
          {ORDER_STATUS_LABEL[status]}
        </span>
        <span className="font-en truncate text-[11px] text-muted">#{o.orderNumber}</span>
      </div>
      <div className="mt-2 flex gap-3">
        <ProductVisual imageUrl={o.imageUrl} category={o.category} alt="" sizes="56px" className="h-14 w-14 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[15px] font-bold leading-snug text-ink">{o.itemsLabel}</p>
          <p className="truncate text-[12.5px] text-ink-2">{o.storeName}</p>
          <p className="tnum mt-0.5 text-[12.5px] text-ink-2">
            受取 {pickupLabel(o.pickupStartAt, o.pickupEndAt, now)}・<span className="font-semibold text-ink">{yen(o.total)}</span>
          </p>
        </div>
      </div>
      <StatusNote order={o} status={status} />
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
        <span className="tnum text-[11px] text-muted">注文 {dateTime(o.createdAt)}</span>
        <span className="inline-flex items-center gap-0.5 text-[13px] font-bold text-forest" data-testid="order-cta">
          {cta.label}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function StatusNote({ order: o, status }: { order: MyOrderCard; status: OrderStatus }) {
  const cls = "mt-2 rounded-xl px-3 py-2 text-[12.5px]";
  if (status === "picked_up") {
    return (
      <p className={cn(cls, "bg-leaf-soft font-semibold text-forest-2")} data-testid="order-note">
        ✓ 食べつなぎました{o.pickedUpAt ? `（${dateTime(o.pickedUpAt)}）` : ""}
      </p>
    );
  }
  if (status === "unclaimed") {
    return (
      <p className={cn(cls, "bg-canvas text-ink-2")} data-testid="order-note">
        <span className="block font-semibold text-ink">受取時間を過ぎました</span>
        この注文は受取時間内に受取完了されませんでした。
      </p>
    );
  }
  if (status === "refunded") {
    return (
      <p className={cn(cls, "tnum bg-canvas text-ink-2")} data-testid="order-note">
        {o.refund?.status === "succeeded"
          ? `返金額 ${yen(o.refund.amount)}・${dateTime(o.refund.at)}`
          : o.refund
            ? `返金の手続き中です（${yen(o.refund.amount)}）`
            : "この注文は返金済みです。"}
      </p>
    );
  }
  if (status === "pending_payment") {
    return (
      <p className={cn(cls, "bg-clay-soft text-clay")} data-testid="order-note">
        {o.payable ? "お支払いが完了していません。" : "お支払いの期限が過ぎました。"}
      </p>
    );
  }
  return null;
}
