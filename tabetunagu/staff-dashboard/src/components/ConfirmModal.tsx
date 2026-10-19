import { useEffect, useRef } from "react";
import { hm } from "../lib/useNow";
import type { Pickup } from "../data/types";

type Props = { pickup: Pickup; busy: boolean; onConfirm: () => void; onCancel: () => void };

/** 長押しで開く「手動で完了にする」確認（QR が読めなかったときだけ使う） */
export function ConfirmModal({ pickup, busy, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-lg rounded-[28px] bg-white p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-black tracking-wider text-alert">手動で完了にする</p>
        <h2 id="confirm-title" className="mt-1 text-[26px] font-black leading-snug">
          {pickup.customerName}の受け取りを完了にしますか？
        </h2>
        <p className="num mt-2 text-lg font-bold text-stone-700">
          {hm(pickup.start)}〜{hm(pickup.end)}・{pickup.items.map((i) => `${i.name}×${i.qty}`).join("・")}・予約番号 {pickup.code}
        </p>
        <p className="mt-3 rounded-2xl bg-stone-100 px-4 py-3 text-[15px] font-medium leading-relaxed text-stone-700">
          お客様の店頭QRが読み取れなかったときだけ使ってください。「手動完了」として記録され、運営にも表示されます。
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button ref={cancelRef} type="button" onClick={onCancel} className="h-16 rounded-2xl border-2 border-stone-300 text-xl font-black">
            やめる
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="h-16 rounded-2xl bg-brand text-xl font-black text-white disabled:opacity-60">
            {busy ? "記録中…" : "完了にする"}
          </button>
        </div>
      </div>
    </div>
  );
}
