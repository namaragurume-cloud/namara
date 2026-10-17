"use client";

import { useActionState, useState } from "react";
import { cancelReservationAction } from "@/app/actions/user";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

/** 誤操作を防ぐため2段階で確認する */
export function CancelReservationButton({ reservationId }: { reservationId: string }) {
  const [state, action] = useActionState(cancelReservationAction, null);
  const [confirming, setConfirming] = useState(false);
  if (state?.ok) return <Notice tone="success">{state.message}</Notice>;
  return (
    <div className="space-y-2">
      {state && !state.ok && <Notice tone="error">{state.message}</Notice>}
      {confirming ? (
        <form action={action} className="space-y-2 rounded-2xl border border-line p-4">
          <input type="hidden" name="reservationId" value={reservationId} />
          <p className="text-[13px] font-semibold">この予約をキャンセルしますか？</p>
          <p className="text-[12px] text-muted">キャンセルすると、ほかの方が予約できるようになります。</p>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
              やめる
            </Button>
            <SubmitButton variant="danger" className="flex-1" pendingLabel="キャンセル中…">
              キャンセルする
            </SubmitButton>
          </div>
        </form>
      ) : (
        <Button type="button" variant="ghost" className="w-full text-muted" onClick={() => setConfirming(true)}>
          予約をキャンセルする
        </Button>
      )}
    </div>
  );
}
