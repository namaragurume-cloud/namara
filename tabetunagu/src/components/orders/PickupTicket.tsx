import { CircleCheck, Clock, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../ui/cn";
import { hhmm, monthDay, yen } from "@/lib/format";
import type { MyOrderView } from "@/server/services/payments";

/**
 * デジタル受取チケット。店舗スタッフが一目で「決済済みの TABETUNAGU 注文」と分かる表示。
 * 受取時間・注文番号・状態は大きく、スワイプ操作（children）はチケットのすぐ下に置く。
 */
export function PickupTicket({ order, children }: { order: MyOrderView; children?: ReactNode }) {
  const done = order.status === "picked_up";
  const missed = order.phase === "unclaimed";
  return (
    <section
      aria-label="受取チケット"
      data-testid="pickup-ticket"
      className={cn(
        "overflow-hidden rounded-3xl border-2 shadow-sm",
        done ? "border-line bg-canvas" : missed ? "border-clay/40 bg-paper" : "border-forest bg-paper",
      )}
    >
      <div className={cn("flex items-center justify-between px-4 py-2.5 text-white", done ? "bg-ink-2" : missed ? "bg-clay" : "bg-forest")}>
        <p className="font-en text-[13px] font-semibold tracking-[0.18em]">TABETUNAGU</p>
        <p className="text-[13px] font-bold">受取チケット</p>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-leaf-soft px-3 py-1 text-[13px] font-bold text-forest">
            <CircleCheck className="h-4 w-4" aria-hidden />
            支払い済み
          </span>
          <span
            data-testid="pickup-status"
            className={cn(
              "rounded-full px-3 py-1 text-[13px] font-bold",
              done ? "bg-ink text-white" : missed ? "bg-clay-soft text-clay" : "bg-sand text-ink",
            )}
          >
            {done ? "受取完了" : missed ? "未受取" : "受取待ち"}
          </span>
        </div>

        <ul className="space-y-0.5">
          {order.items.map((item, i) => (
            <li key={i} className="text-[19px] font-bold leading-snug">
              {item.name} <span className="tnum">×{item.quantity}</span>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-canvas px-3 py-3">
          <div>
            <p className="flex items-center gap-1 text-[11.5px] text-muted">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              受取時間（{monthDay(order.pickupStartAt)}）
            </p>
            <p className="tnum text-[22px] font-bold leading-tight">
              {hhmm(order.pickupStartAt)}〜{hhmm(order.pickupEndAt)}
            </p>
          </div>
          <div>
            <p className="text-[11.5px] text-muted">注文番号</p>
            <p className="font-en text-[22px] font-semibold leading-tight tracking-[0.12em]">#{order.orderNumber}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[13px]">
          <p className="flex min-w-0 items-center gap-1 text-ink-2">
            <MapPin className="h-4 w-4 shrink-0 text-forest" aria-hidden />
            <span className="truncate">{order.storeName}</span>
          </p>
          <p className="tnum shrink-0 font-semibold">合計 {yen(order.total)}</p>
        </div>

        {!done && !missed && <p className="text-center text-[13px] font-bold text-forest">店舗スタッフへこの画面をお見せください。</p>}
        {children}
      </div>
    </section>
  );
}
