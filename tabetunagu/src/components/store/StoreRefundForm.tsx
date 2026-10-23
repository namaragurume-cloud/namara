"use client";

import { useActionState } from "react";
import { storeRefundOrderAction } from "@/app/actions/pickup";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

/**
 * 店舗都合のキャンセル・全額返金。通常の受取では使わないため、折りたたんだ「その他の操作」の中に置く。
 * 理由の入力と確認ダイアログが必須。
 */
export function StoreRefundForm({ storeId, orderId, orderNumber }: { storeId: string; orderId: string; orderNumber: string }) {
  const [state, action] = useActionState(storeRefundOrderAction, null);
  if (state?.ok) return <Notice tone="success">{state.message}</Notice>;
  return (
    <details className="text-[13px]">
      <summary className="cursor-pointer select-none text-muted">その他の操作</summary>
      <form
        action={action}
        className="mt-2 space-y-2 rounded-xl border border-clay/25 bg-clay-soft/40 p-3"
        onSubmit={(e) => {
          if (!window.confirm(`注文 #${orderNumber} を店舗都合でキャンセルし、お客様へ全額返金します。よろしいですか？`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="orderId" value={orderId} />
        <label className="block">
          <span className="text-[12px] font-semibold">店舗都合でキャンセルする理由（必須・お客様には返金のみ通知）</span>
          <input name="reason" required maxLength={200} className="field mt-1" placeholder="例：品切れのため" />
        </label>
        {state && !state.ok && <Notice tone="error">{state.message}</Notice>}
        <SubmitButton variant="danger" size="sm" pendingLabel="返金しています…">
          店舗都合でキャンセル・返金
        </SubmitButton>
      </form>
    </details>
  );
}
