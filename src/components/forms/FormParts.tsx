"use client";

import { CircleAlert, CircleCheck, LoaderCircle, Send } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { site } from "@/data/site";
import { CTAButton } from "@/components/ui/CTAButton";

export function NotConfiguredNotice() {
  return (
    <div role="note" className="mb-10 rounded-2xl border border-brand/30 bg-brand/5 p-5 text-sm leading-relaxed">
      <p className="flex items-center gap-2 font-bold text-brand">
        <CircleAlert size={18} aria-hidden="true" />
        現在、フォームの送信設定を準備中です
      </p>
      <p className="mt-2 text-ink/80">
        お手数ですが、
        <a href={site.instagram.dmUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4">
          Instagram DM（{site.instagram.handle}）
        </a>
        からご連絡ください。
      </p>
    </div>
  );
}

export function ErrorSummary({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-brand/5 p-4 text-sm font-semibold text-brand">
      <CircleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

export function SubmitButton({ submitting, disabled, children }: { submitting: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={submitting || disabled}
      aria-busy={submitting}
      className="group inline-flex min-h-[60px] w-full items-center justify-center gap-3 rounded-full bg-brand px-10 text-base font-bold tracking-wider text-white shadow-[0_10px_30px_-12px_rgba(199,62,51,0.7)] transition-all duration-300 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:w-auto sm:min-w-[320px]"
    >
      {submitting ? (
        <>
          <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
          送信中…
        </>
      ) : (
        <>
          {children}
          <Send size={18} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
        </>
      )}
    </button>
  );
}

export function SuccessPanel({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <div className="anim-fade-up rounded-[28px] bg-mist p-8 text-center md:p-16">
      <CircleCheck size={56} strokeWidth={1.4} className="mx-auto text-brand" aria-hidden="true" />
      <h2 ref={ref} tabIndex={-1} className="mt-6 text-2xl font-bold outline-none md:text-3xl">
        {title}
      </h2>
      <div className="mx-auto mt-6 max-w-xl text-[15px] leading-[2] text-muted">{children}</div>
      <div className="mt-10 flex justify-center">
        <CTAButton href="/" variant="outline" trackLocation="form_success">
          トップページへ戻る
        </CTAButton>
      </div>
    </div>
  );
}
