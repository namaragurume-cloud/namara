"use client";

import { ChevronsRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent } from "react";
import { pickupOrderAction, pickupSwipeStartedAction } from "@/app/actions/pickup";
import { cn } from "../ui/cn";
import { Notice } from "../ui/Section";

const KNOB = 56;
/** これ以上右へスワイプしたら確定（トラック幅に対する割合） */
const CONFIRM_RATIO = 0.9;

/**
 * 「→ スワイプして受取完了」。
 * - 一定距離以上の横スワイプでのみ確定（タップ・クリックだけでは確定しない）
 * - キーボード: つまみにフォーカスして → キーで少しずつ動かし、右端まで動かすと確定（誤操作を防ぐため複数回の操作が必要）
 */
export function SwipeToConfirm({ orderId, label = "スワイプして受取完了" }: { orderId: string; label?: string }) {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startAt: number; pointerId: number } | null>(null);
  const started = useRef(false);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [width, setWidth] = useState(300);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const maxX = Math.max(1, width - KNOB - 8);

  const markStarted = useCallback(() => {
    if (started.current) return;
    started.current = true;
    void pickupSwipeStartedAction(orderId);
  }, [orderId]);

  const confirm = useCallback(
    (swipeMs: number) => {
      setX(maxX);
      startTransition(async () => {
        const res = await pickupOrderAction(orderId, swipeMs);
        if (res?.ok) {
          router.refresh();
        } else {
          setError(res?.message ?? "受取完了にできませんでした。");
          setX(0);
        }
      });
    },
    [orderId, router, maxX],
  );

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (pending) return;
    setError(null);
    drag.current = { startX: e.clientX - x, startAt: Date.now(), pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const next = Math.min(maxX, Math.max(0, e.clientX - drag.current.startX));
    if (next > maxX * 0.2) markStarted();
    setX(next);
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const swipeMs = Date.now() - drag.current.startAt;
    drag.current = null;
    setDragging(false);
    if (x >= maxX * CONFIRM_RATIO) confirm(swipeMs);
    else setX(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (pending) return;
    const step = maxX / 4;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      markStarted();
      const next = Math.min(maxX, x + step);
      setX(next);
      if (next >= maxX * CONFIRM_RATIO) confirm(0);
    } else if (e.key === "ArrowLeft" || e.key === "Home" || e.key === "Escape") {
      e.preventDefault();
      setX(0);
    }
  };

  const progress = Math.round((x / maxX) * 100);

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        data-testid="pickup-swipe-track"
        className="relative h-16 select-none overflow-hidden rounded-full bg-forest text-white"
        style={{ touchAction: "pan-y" }}
      >
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full bg-leaf/60"
          style={{ width: x + KNOB + 4, transition: dragging ? "none" : "width 200ms ease" }}
        />
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center pl-12 text-[15px] font-bold tracking-wide">
          {pending ? "確認しています…" : `→ ${label}`}
        </p>
        <button
          type="button"
          role="slider"
          aria-label={`${label}（右へスワイプ。キーボードでは → キーで右端まで動かす）`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          data-testid="pickup-swipe-knob"
          disabled={pending}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className={cn(
            "absolute top-1 left-1 flex items-center justify-center rounded-full bg-paper text-forest shadow-md outline-offset-2",
            dragging ? "cursor-grabbing" : "cursor-grab",
          )}
          style={{
            width: KNOB,
            height: KNOB,
            transform: `translateX(${x}px)`,
            transition: dragging ? "none" : "transform 200ms ease",
            touchAction: "none",
          }}
        >
          {pending ? <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden /> : <ChevronsRight className="h-7 w-7" aria-hidden />}
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
