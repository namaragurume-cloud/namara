"use client";

import Link from "next/link";
import { useActionState } from "react";
import { checkinAction } from "@/app/actions/user";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

export function CheckinForm({ token, disabled }: { token: string; disabled?: boolean }) {
  const [state, action] = useActionState(checkinAction, null);
  const relatedId = state?.data?.reservationId as string | null | undefined;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state && !state.ok && (
        <Notice tone="error">
          {state.message}
          {state.code === "already_completed" && relatedId && (
            <Link href={`/done/${relatedId}`} className="ml-1 font-semibold underline underline-offset-4">
              完了画面を見る
            </Link>
          )}
        </Notice>
      )}
      <SubmitButton size="lg" className="h-16 w-full text-[17px]" pendingLabel="確認しています…" disabled={disabled}>
        受け取りを確定する
      </SubmitButton>
      <p className="text-center text-[11.5px] text-muted">お店のスタッフの前で押してください。押すと「食べつなぎ完了」になります。</p>
    </form>
  );
}
