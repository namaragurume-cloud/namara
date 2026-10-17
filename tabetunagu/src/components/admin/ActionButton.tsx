"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions/state";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

/** 引数なしの管理操作ボタン（結果メッセージ付き） */
export function ActionButton({
  action,
  label,
  variant = "secondary",
  confirm,
}: {
  action: () => Promise<ActionState>;
  label: string;
  variant?: "primary" | "secondary" | "dark" | "danger";
  confirm?: string;
}) {
  const [state, formAction] = useActionState(async () => action(), null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="space-y-2"
    >
      <SubmitButton variant={variant} size="sm">
        {label}
      </SubmitButton>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>}
    </form>
  );
}

/** フォーム値付きの管理操作（useActionState 形式の action） */
export function ActionForm({
  action,
  children,
  submitLabel,
  className,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <SubmitButton size="sm">{submitLabel}</SubmitButton>
      {state && (
        <div className="mt-2 w-full">
          <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>
        </div>
      )}
    </form>
  );
}
