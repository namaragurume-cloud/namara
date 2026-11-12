"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";
import { corpCategoryOptions, corpContactSchema } from "@/lib/validation";
import { aria, Checkbox, Field, Honeypot } from "./fields";
import { ErrorSummary, NotConfiguredNotice, SubmitButton, SuccessPanel } from "./FormParts";
import { Turnstile } from "./Turnstile";
import { useFormSubmit } from "./useFormSubmit";

const val = (form: HTMLFormElement, name: string) =>
  ((form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "").trim();

/** 株式会社North Pleasure（/corp）のお問い合わせフォーム */
export function CorpContactForm({ configured }: { configured: boolean }) {
  const { status, errors, message, onSubmit, markStarted } = useFormSubmit({
    endpoint: "/api/corp-contact",
    schema: corpContactSchema,
    collect: (f) => ({
      name: val(f, "name"),
      company: val(f, "company"),
      email: val(f, "email"),
      category: f.querySelector<HTMLInputElement>('input[name="category"]:checked')?.value ?? "",
      message: val(f, "message"),
      privacy: (f.elements.namedItem("privacy") as HTMLInputElement | null)?.checked ?? false,
    }),
    onSuccess: () => track("generate_lead", { form: "corp" }),
  });

  if (status === "success") {
    return (
      <SuccessPanel title="お問い合わせを受け付けました">
        <p>お問い合わせいただき、ありがとうございます。</p>
        <p>内容を確認のうえ、ご入力いただいたメールアドレス宛にご連絡いたします。</p>
      </SuccessPanel>
    );
  }

  const e = errors;
  return (
    <form noValidate onSubmit={onSubmit} onFocus={markStarted} className="relative space-y-8" aria-label="お問い合わせフォーム">
      {!configured && <NotConfiguredNotice />}
      <Honeypot />

      <div className="grid gap-8 md:grid-cols-2">
        <Field id="name" label="お名前" required error={e.name}>
          <input {...aria("name", e.name)} type="text" autoComplete="name" className="field-input" placeholder="例）山田 太郎" />
        </Field>
        <Field id="company" label="会社名・店舗名" error={e.company}>
          <input {...aria("company", e.company)} type="text" autoComplete="organization" className="field-input" />
        </Field>
      </div>

      <Field id="email" label="メールアドレス" required error={e.email}>
        <input {...aria("email", e.email)} type="email" autoComplete="email" inputMode="email" className="field-input" placeholder="例）info@example.com" />
      </Field>

      <Field id="category" label="お問い合わせの種類" error={e.category} as="fieldset">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {corpCategoryOptions.map((o) => (
            <label key={o} className="group relative cursor-pointer">
              <input type="radio" name="category" value={o} className="peer sr-only" />
              <span className="flex h-full min-h-[52px] items-center justify-center rounded-[10px] border border-line bg-white px-3 py-2 text-center text-[13px] leading-snug font-bold transition-colors group-hover:border-ink/40 peer-checked:border-brand peer-checked:bg-brand/5 peer-checked:text-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand sm:text-[14px]">
                {o}
              </span>
            </label>
          ))}
        </div>
      </Field>

      <Field id="message" label="お問い合わせ内容" required error={e.message}>
        <textarea {...aria("message", e.message)} rows={6} className="field-input resize-y" />
      </Field>

      <Field id="agreements" label="同意事項" required error={e.privacy} as="fieldset">
        <Checkbox name="privacy" error={e.privacy}>
          <Link href="/privacy" target="_blank" className="font-bold underline underline-offset-4 hover:text-brand">
            プライバシーポリシー
          </Link>
          に同意する
        </Checkbox>
      </Field>

      <Turnstile />
      <ErrorSummary message={message} />

      <div className="flex justify-center pt-2">
        <SubmitButton submitting={status === "submitting"} disabled={!configured}>
          送信する
        </SubmitButton>
      </div>
    </form>
  );
}
