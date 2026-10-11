"use client";

import { useRef, useState } from "react";
import type { z } from "zod";
import { toFieldErrors } from "@/lib/validation";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * フォーム送信の共通処理。
 * クライアント側で検証 → API に送信 → サーバーの結果に応じて表示を切り替えます。
 * 成功画面はサーバーが送信成功を返した場合のみ表示します。
 */
export function useFormSubmit<S extends z.ZodType>({
  endpoint,
  schema,
  collect,
  onSuccess,
}: {
  endpoint: string;
  schema: S;
  collect: (form: HTMLFormElement) => Record<string, unknown>;
  onSuccess?: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const startedAt = useRef<number>(0);
  const busy = useRef(false);

  const markStarted = () => {
    if (!startedAt.current) startedAt.current = Date.now();
  };

  const focusFirstError = (form: HTMLFormElement, errs: Record<string, string>) => {
    const first = Object.keys(errs)[0];
    const el = form.querySelector<HTMLElement>(`[name="${first}"]`);
    el?.focus();
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy.current) return; // 二重送信防止
    const form = e.currentTarget;
    const data = {
      ...collect(form),
      website: (form.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "",
      startedAt: startedAt.current || undefined,
      turnstileToken:
        (form.elements.namedItem("cf-turnstile-response") as HTMLInputElement | null)?.value ?? "",
    };

    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const errs = toFieldErrors(parsed.error);
      setErrors(errs);
      setStatus("error");
      setMessage("入力内容をご確認ください。");
      focusFirstError(form, errs);
      return;
    }

    busy.current = true;
    setErrors({});
    setStatus("submitting");
    setMessage("");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; message: string; fieldErrors?: Record<string, string> }
        | null;

      if (res.ok && body?.ok) {
        setStatus("success");
        onSuccess?.();
        return;
      }
      const errs = body && !body.ok && body.fieldErrors ? body.fieldErrors : {};
      setErrors(errs);
      setStatus("error");
      setMessage(
        body && !body.ok
          ? body.message
          : "送信に失敗しました。時間をおいて再度お試しください。",
      );
      if (Object.keys(errs).length) focusFirstError(form, errs);
      // Turnstile を再実行できるようにリセット
      (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
    } catch {
      setStatus("error");
      setMessage("通信エラーが発生しました。インターネット接続をご確認のうえ、再度お試しください。");
    } finally {
      busy.current = false;
    }
  };

  return { status, errors, message, onSubmit, markStarted };
}
