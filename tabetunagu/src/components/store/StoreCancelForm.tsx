"use client";

import { useActionState, useState } from "react";
import { storeCancelAction } from "@/app/actions/store";
import { SubmitButton } from "../ui/SubmitButton";

/** 店舗都合のキャンセル（品切れ等）。理由は必須で、ユーザーにも表示される。 */
export function StoreCancelForm({ storeId, reservationId }: { storeId: string; reservationId: string }) {
  const [state, action] = useActionState(storeCancelAction, null);
  const [open, setOpen] = useState(false);
  if (state?.ok) return <span className="text-[12px] text-muted">キャンセル済み</span>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[12px] font-semibold text-muted hover:text-clay">
        店舗都合でキャンセル
      </button>
    );
  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-1.5">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="reservationId" value={reservationId} />
      <input name="reason" required maxLength={200} placeholder="理由（例：品切れのため）" className="field h-8 w-44 py-1 text-[12px]" />
      <SubmitButton variant="danger" size="sm">
        確定
      </SubmitButton>
      {state && !state.ok && <span className="w-full text-right text-[12px] text-clay">{state.message}</span>}
    </form>
  );
}
