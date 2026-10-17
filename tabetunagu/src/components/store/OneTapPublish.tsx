"use client";

import { Zap } from "lucide-react";
import { useActionState } from "react";
import { publishTemplateAction } from "@/app/actions/store";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

/** 「いつものBOXを出品」: テンプレートから今日の受取時間でワンタップ出品 */
export function OneTapPublish({
  storeId,
  templateId,
  label,
  detail,
}: {
  storeId: string;
  templateId: string;
  label: string;
  detail: string;
}) {
  const [state, action] = useActionState(publishTemplateAction, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="templateId" value={templateId} />
      <SubmitButton variant="secondary" className="h-auto w-full justify-start rounded-2xl px-4 py-3 text-left" pendingLabel="出品しています…">
        <Zap className="h-5 w-5 shrink-0 text-forest" aria-hidden />
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-bold">{label}</span>
          <span className="tnum block truncate text-[12px] font-normal text-muted">{detail}</span>
        </span>
      </SubmitButton>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>}
    </form>
  );
}
