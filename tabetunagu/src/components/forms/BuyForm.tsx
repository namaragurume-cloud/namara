"use client";

import { Minus, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { purchaseAction } from "@/app/actions/payments";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

/**
 * v2 購入確認（事前決済）。表示する金額は目安で、注文の金額はサーバーで確定する。
 * つなぐチャージは1注文ごと（数量によらず一定）。
 */
export function BuyForm({
  productId,
  unitPrice,
  tsunaguCharge,
  max,
  unit,
  pointsNote,
}: {
  productId: string;
  unitPrice: number;
  tsunaguCharge: number;
  pointsNote?: string;
  max: number;
  unit: string;
}) {
  const [state, action] = useActionState(purchaseAction, null);
  const [qty, setQty] = useState(1);
  const subtotal = unitPrice * qty;
  const total = subtotal + tsunaguCharge;
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
      <dl className="tnum space-y-2 rounded-2xl bg-canvas px-4 py-4 text-[14px]" data-testid="buy-summary">
        <div className="flex justify-between">
          <dt className="text-ink-2">商品小計</dt>
          <dd>{subtotal.toLocaleString("ja-JP")}円</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-2">つなぐチャージ</dt>
          <dd>{tsunaguCharge.toLocaleString("ja-JP")}円</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-2">
          <dt className="font-bold">お支払い合計</dt>
          <dd className="text-[22px] font-semibold">
            {total.toLocaleString("ja-JP")}
            <span className="text-[12px]">円</span>
          </dd>
        </div>
      </dl>
      {pointsNote && (
        <p className="px-1 text-[12px] text-forest" data-testid="points-note">
          {pointsNote}
        </p>
      )}
      {state && !state.ok && <Notice tone="error">{state.message}</Notice>}
      <SubmitButton size="lg" className="w-full" pendingLabel="決済ページへ移動しています…">
        {total.toLocaleString("ja-JP")}円で食べつなぐ
      </SubmitButton>
    </form>
  );
}
