import { useCallback, useRef, useState } from "react";

/**
 * 長押し検出（指・マウス共通）。押している間 pressing=true になり、ms 経過で onLongPress。
 * 指が動いた（スクロール）・離れたときは取り消す。
 */
export function useLongPress(onLongPress: () => void, { ms = 700, enabled = true } = {}) {
  const timer = useRef<number | undefined>(undefined);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [pressing, setPressing] = useState(false);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    origin.current = null;
    setPressing(false);
  }, []);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!enabled || (e.pointerType === "mouse" && e.button !== 0)) return;
      origin.current = { x: e.clientX, y: e.clientY };
      setPressing(true);
      timer.current = window.setTimeout(() => {
        setPressing(false);
        timer.current = undefined;
        if (navigator.vibrate) navigator.vibrate(30);
        onLongPress();
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (origin.current && Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 12) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    // スマホの長押しメニュー（コピー等）を出さない
    onContextMenu: (e: React.MouseEvent) => {
      if (enabled) e.preventDefault();
    },
  };
  return { pressing, handlers, holdMs: ms };
}
