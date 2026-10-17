"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./Button";

type Props = ComponentProps<"button"> & {
  variant?: Parameters<typeof buttonClass>[0];
  size?: Parameters<typeof buttonClass>[1];
  pendingLabel?: string;
};

/** フォーム送信中は二重送信を防ぐ */
export function SubmitButton({ variant, size, className, children, pendingLabel, disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending} className={buttonClass(variant, size, className)} {...props}>
      {pending ? (pendingLabel ?? "送信中…") : children}
    </button>
  );
}
