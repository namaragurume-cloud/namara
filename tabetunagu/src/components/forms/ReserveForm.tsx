"use client";

import { Minus, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { reserveAction } from "@/app/actions/user";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

export function ReserveForm({ productId, unitPrice, max, unit }: { productId: string; unitPrice: number; max: number; unit: string }) {
  const [state, action] = useActionState(reserveAction, null);
  const [qty, setQty] = useState(1);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="quantity" value={qty} />
      {max > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-line px-4 py-3">
          <span className="text-[14px] font-semibold">数量</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label="減らす"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line disabled:opacity-40"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <span className="tnum w-10 text-center text-[17px] font-semibold" aria-live="polite">
              {qty}
              <span className="text-[11px]">{unit}</span>
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(max, q + 1))}
              disabled={qty >= max}
              aria-label="増やす"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
      <div className="flex items-baseline justify-between px-1">
        <span className="text-[13px] text-muted">お店でのお支払い（予定）</span>
        <span className="tnum text-[22px] font-semibold">
          {(unitPrice * qty).toLocaleString("ja-JP")}
          <span className="text-[12px]">円</span>
        </span>
      </div>
      {state && !state.ok && <Notice tone="error">{state.message}</Notice>}
      <SubmitButton size="lg" className="w-full" pendingLabel="予約しています…">
        予約を確定する
      </SubmitButton>
    </form>
  );
}
