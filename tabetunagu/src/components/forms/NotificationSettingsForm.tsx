"use client";

import { useActionState } from "react";
import { updateNotificationsAction } from "@/app/actions/user";
import { AREAS } from "@/lib/categories";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

export function NotificationSettingsForm({ enabled, areas, lineLinked }: { enabled: boolean; areas: string[]; lineLinked: boolean }) {
  const [state, action] = useActionState(updateNotificationsAction, null);
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-[14px] font-semibold">今夜のTABETUNAGU（まとめ通知）</span>
          <span className="block text-[12px] text-muted">夕方に1日1通まで、エリアごとの出品数をLINEでお知らせします。</span>
        </span>
        <input type="checkbox" name="notifyEnabled" defaultChecked={enabled} className="h-5 w-5 accent-[var(--forest)]" />
      </label>
      <fieldset>
        <legend className="mb-2 text-[12px] font-semibold text-muted">通知するエリア（未選択ならすべて）</legend>
        <div className="flex flex-wrap gap-2">
          {AREAS.map((a) => (
            <label key={a.id} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] has-[:checked]:border-forest has-[:checked]:bg-leaf-soft has-[:checked]:text-forest">
              <input type="checkbox" name="notifyAreas" value={a.id} defaultChecked={areas.includes(a.id)} className="sr-only" />
              {a.label}
            </label>
          ))}
        </div>
      </fieldset>
      {!lineLinked && <p className="text-[12px] text-muted">LINEでログインすると通知を受け取れます。</p>}
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>}
      <SubmitButton variant="secondary" size="sm">
        保存する
      </SubmitButton>
    </form>
  );
}
