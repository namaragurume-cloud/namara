"use client";

import { useActionState } from "react";
import { setLineFeaturedOptInAction } from "@/app/actions/line-digest";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

/** マイページ: LINE 通知「今日の注目商品」の ON / OFF（既定は OFF。本人が ON にしたときだけ送る） */
export function LineFeaturedOptInForm({ on, lineLinked }: { on: boolean; lineLinked: boolean }) {
  const [state, action] = useActionState(setLineFeaturedOptInAction, null);
  return (
    <form action={action} className="space-y-3" data-testid="line-featured-optin" data-on={on ? "on" : "off"}>
      <input type="hidden" name="on" value={on ? "false" : "true"} />
      <div className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-[12px] font-semibold text-muted">LINE通知</span>
          <span className="block text-[14px] font-semibold">今日の注目商品</span>
          <span className="block text-[12px] text-muted">夕方に1日1回まで、今夜受け取れるおすすめを最大3件、TABETUNAGUのLINE公式アカウントからお届けします。</span>
        </span>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-bold ${on ? "bg-leaf-soft text-forest" : "bg-canvas text-muted"}`}>{on ? "ON" : "OFF"}</span>
      </div>
      {lineLinked ? (
        <>
          {on && <p className="text-[12px] text-muted">届かない場合は、LINE公式アカウントを友だち追加しているか（ブロックしていないか）をご確認ください。</p>}
          <SubmitButton variant={on ? "secondary" : "primary"} size="sm">
            {on ? "OFFにする" : "ONにする"}
          </SubmitButton>
        </>
      ) : (
        <p className="text-[12px] text-muted">LINEでログインすると、通知を受け取れます。</p>
      )}
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>}
    </form>
  );
}
