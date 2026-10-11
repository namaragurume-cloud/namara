"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import { budgetOptions, contactSchema, industryOptions } from "@/lib/validation";
import { aria, Checkbox, Field, Honeypot } from "./fields";
import { ErrorSummary, NotConfiguredNotice, SubmitButton, SuccessPanel } from "./FormParts";
import { Turnstile } from "./Turnstile";
import { useFormSubmit } from "./useFormSubmit";

const val = (form: HTMLFormElement, name: string) =>
  ((form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "").trim();

export function ContactForm({ configured }: { configured: boolean }) {
  const params = useSearchParams();
  const creator = params.get("creator")?.slice(0, 200) ?? "";

  const { status, errors, message, onSubmit, markStarted } = useFormSubmit({
    endpoint: "/api/contact",
    schema: contactSchema,
    collect: (f) => ({
      company: val(f, "company"),
      name: val(f, "name"),
      email: val(f, "email"),
      industry: val(f, "industry"),
      product: val(f, "product"),
      budget: val(f, "budget"),
      timing: val(f, "timing"),
      creator: val(f, "creator"),
      message: val(f, "message"),
      privacy: (f.elements.namedItem("privacy") as HTMLInputElement).checked,
    }),
    onSuccess: () => track("generate_lead", { form: "contact" }),
  });

  if (status === "success") {
    return (
      <SuccessPanel title="お問い合わせを受け付けました">
        <p>お問い合わせいただき、ありがとうございます。</p>
        <p>内容を確認のうえ、担当者よりご入力いただいたメールアドレス宛にご連絡いたします。</p>
      </SuccessPanel>
    );
  }

  const e = errors;
  return (
    <form noValidate onSubmit={onSubmit} onFocus={markStarted} className="relative space-y-8" aria-label="企業向けお問い合わせフォーム">
      {!configured && <NotConfiguredNotice />}
      <Honeypot />

      <div className="grid gap-8 md:grid-cols-2">
        <Field id="company" label="会社名・店舗名" required error={e.company}>
          <input {...aria("company", e.company)} type="text" autoComplete="organization" className="field-input" placeholder="例）株式会社〇〇／〇〇食堂" />
        </Field>
        <Field id="name" label="ご担当者名" required error={e.name}>
          <input {...aria("name", e.name)} type="text" autoComplete="name" className="field-input" placeholder="例）山田 太郎" />
        </Field>
      </div>

      <Field id="email" label="メールアドレス" required error={e.email}>
        <input {...aria("email", e.email)} type="email" autoComplete="email" inputMode="email" className="field-input" placeholder="例）info@example.com" />
      </Field>

      <div className="grid gap-8 md:grid-cols-2">
        <Field id="industry" label="業種" error={e.industry}>
          <select {...aria("industry", e.industry)} className="field-input" defaultValue="">
            <option value="">選択してください</option>
            {industryOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field id="budget" label="ご予算" error={e.budget}>
          <select {...aria("budget", e.budget)} className="field-input" defaultValue="">
            <option value="">選択してください</option>
            {budgetOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="product" label="PRしたい商品・サービス" error={e.product}>
        <input {...aria("product", e.product)} type="text" className="field-input" placeholder="例）新メニュー、新店舗のOPEN、新商品など" />
      </Field>

      <div className="grid gap-8 md:grid-cols-2">
        <Field id="timing" label="希望実施時期" error={e.timing}>
          <input {...aria("timing", e.timing)} type="text" className="field-input" placeholder="例）〇月上旬、未定 など" />
        </Field>
        <Field id="creator" label="希望インフルエンサー" error={e.creator}>
          <input {...aria("creator", e.creator)} type="text" className="field-input" defaultValue={creator} placeholder="例）@アカウント名（未定でも可）" />
        </Field>
      </div>

      <Field id="message" label="お問い合わせ内容" required error={e.message}>
        <textarea
          {...aria("message", e.message)}
          rows={7}
          className="field-input resize-y"
          placeholder="PRの目的、ターゲット、ご質問などをご記入ください。"
        />
      </Field>

      <Field id="privacy" label="個人情報の取扱い" required error={e.privacy} as="fieldset">
        <Checkbox name="privacy" error={e.privacy}>
          <Link href="/privacy" target="_blank" className="font-bold underline underline-offset-4 hover:text-brand">
            プライバシーポリシー
          </Link>
          に同意する
        </Checkbox>
      </Field>

      <Turnstile />
      <ErrorSummary message={message} />

      <div className="flex flex-col items-center gap-4 pt-2">
        <SubmitButton submitting={status === "submitting"} disabled={!configured}>
          この内容で送信する
        </SubmitButton>
        <p className="text-xs text-muted">内容を確認のうえ、担当者よりご連絡いたします。</p>
      </div>
    </form>
  );
}
