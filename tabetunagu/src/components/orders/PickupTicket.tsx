import { CircleCheck, Clock, Hand, Info, Leaf, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { dateTime, pickupLabel, yen } from "@/lib/format";
import { ticketTiming } from "@/lib/ticket";
import type { MyOrderView } from "@/server/services/payments";
import { cn } from "../ui/cn";

/**
 * デジタル受取チケット。お店でスマホをスタッフに見せる前提で、
 * 「支払い済み」「受取時間」「商品」「注文番号」を大きく、上から順に置く（腕の長さでも読める大きさ・コントラスト）。
 * 受取時間中は、スタッフへの案内とスワイプ操作（children）をチケットの中に置く（スクロールしなくても見える）。
 */
export function PickupTicket({ order, now, children }: { order: MyOrderView; now: Date; children?: ReactNode }) {
  const done = order.status === "picked_up";
  const missed = order.phase === "unclaimed";
  const timing = !done && !missed ? ticketTiming(order, now) : null;
  const [day, range] = splitPickupLabel(pickupLabel(order.pickupStartAt, order.pickupEndAt, now));
  return (
    <section
      aria-labelledby="ticket-title"
      data-testid="pickup-ticket"
      data-pickup-start={order.pickupStartAt}
      data-pickup-end={order.pickupEndAt}
      className={cn(
        "overflow-hidden rounded-3xl border-2 bg-paper shadow-sm",
        done ? "border-ink-2/40" : missed ? "border-clay/50" : "border-forest",
      )}
    >
      <div className={cn("px-4 pb-2.5 pt-2 text-white", done ? "bg-ink-2" : missed ? "bg-clay" : "bg-forest")}>
        <p className="font-en flex items-center gap-1 text-[11px] font-semibold tracking-[0.2em] text-white/85">
          <Leaf className="h-3 w-3" aria-hidden />
          TABETUNAGU
        </p>
        <h1 id="ticket-title" className="mt-0.5 text-[22px] font-bold leading-tight">
          受取チケット
        </h1>
      </div>

      <div className="space-y-3 px-4 pb-4 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-forest bg-leaf-soft px-3 py-1.5 text-[24px] font-bold leading-none text-forest-2"
            data-testid="ticket-paid"
          >
            <CircleCheck className="h-7 w-7" strokeWidth={2.4} aria-hidden />
            支払い済み
          </p>
          <span
            data-testid="pickup-status"
            className={cn(
              "rounded-full px-3 py-1.5 text-[14px] font-bold",
              done ? "bg-ink text-white" : missed ? "bg-clay text-white" : "bg-sand text-ink",
            )}
          >
            {done ? "受取完了" : missed ? "未受取" : "受取待ち"}
          </span>
        </div>

        <div data-testid="ticket-time">
          <p className="flex items-center gap-1 text-[12px] font-semibold text-ink-2">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            受取時間
          </p>
          <p className="mt-0.5 text-[16px] font-bold text-ink">{day}</p>
          <p className="tnum text-[32px] font-bold leading-tight tracking-tight text-ink">{range}</p>
          {timing?.note && (
            <p className={cn("tnum mt-0.5 text-[13px] font-bold", "urgent" in timing && timing.urgent ? "text-clay" : "text-ink-2")} data-testid="ticket-time-note">
              {timing.note}
            </p>
          )}
        </div>

        <ul className="space-y-0.5" data-testid="ticket-items">
          {order.items.map((item, i) => (
            <li key={i} className="text-[20px] font-bold leading-snug text-ink">
              {item.name} <span className="tnum whitespace-nowrap">×{item.quantity}</span>
            </li>
          ))}
        </ul>

        {/* チケットの切り取り線 */}
        <div aria-hidden className="relative -mx-4 h-0 border-t-2 border-dashed border-line">
          <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full border-2 border-inherit bg-paper" />
          <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full border-2 border-inherit bg-paper" />
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold text-ink-2">注文番号</p>
            <p className="font-en text-[28px] font-bold leading-tight tracking-[0.12em] text-ink" data-testid="ticket-order-number">
              #{order.orderNumber}
            </p>
          </div>
          <p className="tnum shrink-0 pb-1 text-right text-[12px] text-ink-2">
            お支払い合計
            <span className="block text-[14px] font-semibold text-ink">{yen(order.total)}</span>
          </p>
        </div>

        <div className="space-y-0.5 text-[13px]">
          <p className="flex items-center gap-1 font-semibold text-ink">
            <MapPin className="h-4 w-4 shrink-0 text-forest" aria-hidden />
            {order.storeName}
          </p>
          {order.storeAddress && <p className="pl-5 text-[12px] text-ink-2">{order.storeAddress}</p>}
        </div>

        {done && order.pickedUpAt && (
          <p className="tnum rounded-xl bg-canvas px-3 py-2 text-[13px] text-ink-2" data-testid="ticket-picked-up-at">
            受取完了：<span className="font-semibold text-ink">{dateTime(order.pickedUpAt)}</span>
          </p>
        )}

        {timing && (
          <div className="space-y-2.5 border-t border-line pt-3" data-testid="ticket-guide">
            <div>
              <p className="flex items-center gap-1.5 text-[15.5px] font-bold text-forest-2">
                <Hand className="h-5 w-5 shrink-0" aria-hidden />
                店舗スタッフへこの画面をお見せください。
              </p>
              <p className="mt-1 text-[12.5px] text-ink-2">商品を受け取ったら、ご自身で下のスライダーを操作してください。</p>
            </div>
            {timing.canSwipe && (
              <p className="flex items-center gap-1 text-[12.5px] text-ink-2" data-testid="ticket-swipe-caution">
                <Info className="h-4 w-4 shrink-0 text-forest" aria-hidden />
                商品を受け取ってから操作してください。
              </p>
            )}
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

/** 「本日 18:00〜20:00」を日付と時間帯に分ける */
function splitPickupLabel(label: string): [string, string] {
  const i = label.indexOf(" ");
  return i < 0 ? ["", label] : [label.slice(0, i), label.slice(i + 1)];
}
