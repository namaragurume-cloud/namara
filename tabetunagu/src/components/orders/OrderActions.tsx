"use client";

import { useActionState } from "react";
import { cancelPendingOrderAction, requestRefundAction, resumeCheckoutAction } from "@/app/actions/payments";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";
import { OFFLINE_MESSAGE, useOfflineGuard } from "../forms/offline";

export function ResumeCheckoutForm({ orderId, total }: { orderId: string; total: number }) {
  const [state, action] = useActionState(resumeCheckoutAction, null);
  const { offline, onSubmit } = useOfflineGuard();
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      {offline && <Notice tone="error">{OFFLINE_MESSAGE}</Notice>}
      {state && !state.ok && <Notice tone="error">{state.message}</Notice>}
      <SubmitButton size="lg" className="w-full" pendingLabel="決済ページへ移動しています…">
        {total.toLocaleString("ja-JP")}円のお支払いへ進む
      </SubmitButton>
    </form>
  );
}

export function CancelPendingOrderForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(cancelPendingOrderAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>}
      <SubmitButton variant="secondary" className="w-full" pendingLabel="取り消しています…">
        注文をやめる
      </SubmitButton>
    </form>
  );
}

export function UserRefundForm({ orderId, windowMinutes }: { orderId: string; windowMinutes: number }) {
  const [state, action] = useActionState(requestRefundAction, null);
  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(e) => {
        if (!window.confirm("この注文をキャンセルし、全額を返金します。よろしいですか？")) e.preventDefault();
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <p className="text-[12px] leading-relaxed text-muted">
        お支払いから{windowMinutes}分以内・受取開始前であれば、キャンセルして全額を返金できます。
      </p>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>}
      <SubmitButton variant="danger" className="w-full" pendingLabel="返金しています…">
        キャンセルして返金する
      </SubmitButton>
    </form>
  );
}
