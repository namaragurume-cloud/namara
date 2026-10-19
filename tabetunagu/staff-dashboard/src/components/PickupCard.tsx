import { hm } from "../lib/useNow";
import { useLongPress } from "../lib/useLongPress";
import type { Pickup } from "../data/types";

type Props = {
  pickup: Pickup;
  now: number;
  flash: boolean;
  onRequestManualComplete: (p: Pickup) => void;
};

/**
 * 来店予定カード。受取待ち = 黄色で強調 / 受取完了 = グレーアウト。
 * 受取待ちのカードは長押しで「手動で完了にする」（QRが読めなかったときのフェイルセーフ）。
 */
export function PickupCard({ pickup: p, now, flash, onRequestManualComplete }: Props) {
  const waiting = p.status === "waiting";
  const overdue = waiting && now > p.end;
  const current = waiting && now >= p.start && now <= p.end;
  const { pressing, handlers, holdMs } = useLongPress(() => onRequestManualComplete(p), { enabled: waiting });
  const items = p.items.map((i) => `${i.name}×${i.qty}`).join("・");

  return (
    <li
      {...handlers}
      aria-label={`${hm(p.start)}から${hm(p.end)} ${p.customerName} ${items} ${waiting ? "受取待ち" : "受取完了"}`}
      className={[
        "relative shrink-0 select-none overflow-hidden border-l-[10px] transition-colors",
        waiting ? "rounded-3xl px-4 py-3 sm:px-5 sm:py-4" : "rounded-2xl px-4 py-2 sm:px-5 lg:col-span-2",
        waiting
          ? overdue
            ? "border-alert bg-wait text-stone-950"
            : "border-wait-edge bg-wait text-stone-950"
          : "border-stone-300 bg-done text-done-ink",
        flash ? "animate-flash" : "",
        pressing ? "scale-[0.985]" : "",
        waiting ? "cursor-pointer touch-manipulation" : "",
      ].join(" ")}
    >
      {waiting ? (
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="w-[88px] shrink-0 sm:w-[110px]">
            <p className="num text-[30px] font-extrabold leading-none sm:text-[38px]">{hm(p.start)}</p>
            <p className="num mt-1 text-base font-bold opacity-75 sm:text-lg">〜{hm(p.end)}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[24px] font-black leading-tight sm:text-[28px]">{p.customerName}</p>
            <p className="truncate text-[18px] font-bold leading-snug sm:text-xl">{items}</p>
            <p className="num mt-0.5 text-[13px] font-bold opacity-70">予約番号 {p.code}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1.5 text-[15px] font-black sm:text-base ${overdue ? "bg-alert text-white" : "bg-wait-ink text-white"}`}>
            {overdue ? "時間超過" : current ? "いま受取" : "受取待ち"}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3 sm:gap-5">
          <p className="num w-[88px] shrink-0 text-[20px] font-extrabold sm:w-[110px] sm:text-2xl">{hm(p.start)}</p>
          <p className="min-w-0 flex-1 truncate text-[18px] font-black sm:text-xl">
            {p.customerName}
            <span className="ml-2 text-[15px] font-bold">{items}</span>
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 text-[15px] font-black sm:text-base">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
              <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {p.completedVia === "manual" ? "手動完了" : "受取完了"}
          </span>
        </div>
      )}
      {pressing && (
        <span
          aria-hidden
          className="animate-fill absolute inset-x-0 bottom-0 h-1.5 origin-left bg-wait-ink"
          style={{ ["--hold-ms" as string]: `${holdMs}ms` }}
        />
      )}
    </li>
  );
}
