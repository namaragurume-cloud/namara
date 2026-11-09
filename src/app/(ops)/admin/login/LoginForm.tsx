"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ops/client";
import { inputClass } from "@/components/ops/ui";
import { login } from "../actions";

export function LoginForm() {
  const [state, action] = useActionState(login, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="password" name="password" required autoComplete="current-password" placeholder="パスワード" className={inputClass} />
      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}
      <SubmitButton className="w-full">ログイン</SubmitButton>
    </form>
  );
}
