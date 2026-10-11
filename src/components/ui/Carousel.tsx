"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  label: string;
  /** 各スライドの幅クラス */
  itemClassName?: string;
  theme?: "light" | "dark";
};

/**
 * スクロールスナップを使った軽量カルーセル。
 * スワイプ・横スクロール・前後ボタン・キーボード（Tab）で操作できます。
 */
export function Carousel({ children, label, itemClassName = "w-[82%] sm:w-[46%] lg:w-[31%]", theme = "light" }: Props) {
  const track = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const item = el.firstElementChild as HTMLElement | null;
    const step = item ? item.offsetWidth + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const btn = cn(
    "grid size-12 place-items-center rounded-full border transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-30",
    theme === "dark"
      ? "border-white/25 text-white enabled:hover:bg-white enabled:hover:text-ink"
      : "border-ink/15 text-ink enabled:hover:bg-ink enabled:hover:text-white",
  );

  return (
    <div role="region" aria-roledescription="カルーセル" aria-label={label}>
      <ul
        ref={track}
        className="scrollbar-none -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto px-5 pb-4 md:-mx-10 md:scroll-px-10 md:px-10"
      >
        {Children.map(children, (child, i) => (
          <li className={cn("shrink-0 snap-start", itemClassName)} aria-label={`${i + 1} / ${Children.count(children)}`}>
            {child}
          </li>
        ))}
      </ul>
      {(canPrev || canNext) && (
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className={btn} onClick={() => scroll(-1)} disabled={!canPrev} aria-label="前へ">
            <ChevronLeft size={20} />
          </button>
          <button type="button" className={btn} onClick={() => scroll(1)} disabled={!canNext} aria-label="次へ">
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
