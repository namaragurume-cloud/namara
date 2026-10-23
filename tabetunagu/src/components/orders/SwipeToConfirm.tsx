"use client";

import { Check, ChevronsRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { pickupOrderAction, pickupSwipeStartedAction } from "@/app/actions/pickup";
import { initialSwipe, pickupErrorMessage, PICKUP_ERROR_MESSAGE, REFRESH_ON_ERROR, STARTED_RATIO, swipeReducer } from "@/lib/ticket";
import { cn } from "../ui/cn";

const KNOB = 60;
const PAD = 4;

/**
 * 「右へスワイプして受取完了」（ユーザー本人の操作。店舗の操作ではない）。
 * - 指を離した位置がトラックの 90% 以上のときだけ確定（タップ・クリック・途中まででは確定しない）
 * - 確定中はロックし（二重送信しない）、失敗したら初期位置へ戻す。受取完了の可否はサーバーが正
 * - キーボード: つまみにフォーカスして → キーで少しずつ動かし、右端まで動かすと確定
 * - 縦スクロールを止めないよう、トラックは pan-y、つまみだけ touch-action: none
 */
export function SwipeToConfirm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const frame = useRef<number | null>(null);
  const lastClientX = useRef<number | null>(null);
  const [state, dispatch] = useReducer(swipeReducer, initialSwipe);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const maxX = Math.max(1, width - KNOB - PAD * 2);
  const locked = state.phase === "pending" || state.phase === "done";

  // 確定したらサーバーへ送る（pending になった1回だけ）
  const swipeStartedAt = useRef(0);
  useEffect(() => {
    if (state.phase !== "pending") return;
    const swipeMs = swipeStartedAt.current ? Date.now() - swipeStartedAt.current : 0;
    let cancelled = false;
    (async () => {
      let res: Awaited<ReturnType<typeof pickupOrderAction>> = null;
      try {
        res = await pickupOrderAction(orderId, swipeMs);
      } catch {
        res = null; // 通信エラー
      }
      if (cancelled) return;
      if (res?.ok) {
        dispatch({ type: "result", ok: true });
        router.refresh(); // サーバーの状態（picked_up）で画面を描き直す
      } else {
        dispatch({ type: "result", ok: false, message: res ? pickupErrorMessage(res) : PICKUP_ERROR_MESSAGE });
        if (res?.code && REFRESH_ON_ERROR.has(res.code)) router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.phase, orderId, router]);

  const markStarted = (x: number) => {
    if (started.current || x < maxX * STARTED_RATIO) return;
    started.current = true;
    void pickupSwipeStartedAction(orderId);
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (locked) return;
    swipeStartedAt.current = Date.now();
    lastClientX.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
    dispatch({ type: "down", clientX: e.clientX, at: swipeStartedAt.current });
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (state.phase !== "dragging") return;
    const clientX = e.clientX;
    lastClientX.current = clientX;
    // 1フレームに1回だけ位置を更新する（ドラッグを重くしない）
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      dispatch({ type: "move", clientX, maxX });
    });
    markStarted(clientX - (state.phase === "dragging" ? state.startX : 0));
  };
  const onPointerUp = () => {
    // まだ反映していない最後の位置を反映してから、離した位置で判定する
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
      if (lastClientX.current !== null) dispatch({ type: "move", clientX: lastClientX.current, maxX });
    }
    lastClientX.current = null;
    dispatch({ type: "up", maxX });
  };
  // OS のジェスチャー（iOS の戻るスワイプ・スクロール等）に操作を奪われたときは、確定せずに初期位置へ戻す
  const onPointerCancel = () => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    lastClientX.current = null;
    dispatch({ type: "key", key: "Escape", maxX });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (locked) return;
    if (["ArrowRight", "ArrowLeft", "Home", "Escape"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "ArrowRight") markStarted(maxX);
      dispatch({ type: "key", key: e.key, maxX });
    }
  };

  const dragging = state.phase === "dragging";
  const progress = Math.round((state.x / maxX) * 100);
  const label =
    state.phase === "pending" ? "受取を確認しています…" : state.phase === "done" ? "食べつなぎました！" : "右へスワイプして受取完了";

  return (
    <div className="space-y-2" data-testid="pickup-swipe" data-phase={state.phase}>
      <div
        ref={trackRef}
        data-testid="pickup-swipe-track"
        className={cn("relative h-[68px] select-none overflow-hidden rounded-full", state.phase === "done" ? "bg-leaf" : "bg-forest")}
        style={{ touchAction: "pan-y" }}
      >
        {/* 進んだ分 */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full bg-leaf"
          style={{ width: state.x + KNOB + PAD * 2, transition: dragging ? "none" : "width 200ms ease" }}
        />
        {/* 完了位置 */}
        <span
          aria-hidden
          className="absolute top-1/2 right-[6px] flex h-[56px] w-[56px] -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed border-white/60 text-white/80"
        >
          <Check className="h-6 w-6" />
        </span>
        <p
          aria-live="polite"
          className="pointer-events-none absolute inset-0 flex items-center justify-center pl-14 pr-14 text-[15px] font-bold tracking-wide text-white"
          style={{ opacity: dragging ? Math.max(0.2, 1 - progress / 80) : 1 }}
          data-testid="pickup-swipe-label"
        >
          {label}
        </p>
        <button
          type="button"
          role="slider"
          aria-label="受取完了のスライダー（商品を受け取ってから、右端まで動かしてください。キーボードでは → キーで動かせます）"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-valuetext={state.phase === "pending" ? "受取を確認しています" : `${progress}%`}
          aria-disabled={locked}
          data-testid="pickup-swipe-knob"
          disabled={locked}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onKeyDown={onKeyDown}
          className={cn(
            "absolute top-1 left-1 flex items-center justify-center rounded-full bg-paper text-forest shadow-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-white",
            dragging ? "cursor-grabbing" : "cursor-grab",
          )}
          style={{
            width: KNOB,
            height: KNOB,
            transform: `translate3d(${state.x}px, 0, 0)`,
            transition: dragging ? "none" : "transform 200ms ease",
            touchAction: "none",
            willChange: "transform",
          }}
        >
          {state.phase === "pending" ? (
            <LoaderCircle className="h-7 w-7 animate-spin" aria-hidden />
          ) : state.phase === "done" ? (
            <Check className="h-7 w-7" aria-hidden />
          ) : (
            <ChevronsRight className="h-8 w-8" aria-hidden />
          )}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="rounded-xl border border-clay/25 bg-clay-soft px-3 py-2 text-[13px] text-clay" data-testid="pickup-error">
          {state.error}
        </p>
      )}
    </div>
  );
}
