"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import {
  budgetOptions,
  budgetParams,
  contactSchema,
  industryOptions,
  purposeOptions,
  type BudgetParam,
} from "@/lib/validation";
import { cn } from "@/lib/utils";
import { aria, Checkbox, Field, Honeypot } from "./fields";
import { ErrorSummary, NotConfiguredNotice, SubmitButton, SuccessPanel } from "./FormParts";
import { Turnstile } from "./Turnstile";
import { useFormSubmit } from "./useFormSubmit";

const val = (form: HTMLFormElement, name: string) =>
  ((form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "").trim();

/** 選択肢をボタン風のラジオで表示 */
function ChoiceGroup({
  name,
  options,
  defaultValue,
  columns = 2,
}: {
  name: string;
  options: readonly string[];
  defaultValue?: string;
  columns?: 2 | 4;
}) {
  return (
    <div className={cn("grid gap-2.5", columns === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2")}>
      {options.map((o) => (
        <label key={o} className="group relative cursor-pointer">
          <input type="radio" name={name} value={o} defaultChecked={o === defaultValue} className="peer sr-only" />
          <span className="flex h-full min-h-[52px] items-center justify-center rounded-[10px] border border-line bg-white px-3 py-2 text-center text-[13px] leading-snug font-bold sm:text-[14px] transition-colors group-hover:border-ink/40 peer-checked:border-brand peer-checked:bg-brand/5 peer-checked:text-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
            {o}
          </span>
        </label>
      ))}
    </div>
  );
}

export function ContactForm({ configured }: { configured: boolean }) {
  const params = useSearchParams();
  const creator = params.get("creator")?.slice(0, 200) ?? "";
  const budgetKey = params.get("budget") as BudgetParam | null;
  const initialBudget = budgetKey && budgetKey in budgetParams ? budgetParams[budgetKey] : undefined;

  // お問い合わせページの表示（どこから来たか）を計測
  const viewTracked = useRef(false);
  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;
    track("contact_form_view", { from_creator: Boolean(creator), budget: budgetKey ?? "" });
  }, [creator, budgetKey]);

  const { status, errors, message, onSubmit, markStarted } = useFormSubmit({
    endpoint: "/api/contact",
    schema: contactSchema,
    collect: (f) => ({
      company: val(f, "company"),
      email: val(f, "email"),
      purpose: (f.querySelector<HTMLInputElement>('input[name="purpose"]:checked')?.value ?? ""),
      budget: (f.querySelector<HTMLInputElement>('input[name="budget"]:checked')?.value ?? ""),
      message: val(f, "message"),
      name: val(f, "name"),
      industry: val(f, "industry"),
      product: val(f, "product"),
      timing: val(f, "timing"),
      creator: val(f, "creator"),
      privacy: (f.elements.namedItem("privacy") as HTMLInputElement).checked,
    }),
    // コンバージョンはサーバーで送信に成功した場合のみ記録
    onSuccess: () => track("generate_lead", { form: "contact", from_creator: Boolean(creator), from_budget: Boolean(initialBudget) }),
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
  const detailsOpen = Boolean(creator) || Boolean(e.name || e.industry || e.product || e.timing || e.creator);
  return (
    <form noValidate onSubmit={onSubmit} onFocus={markStarted} className="relative space-y-8" aria-label="無料相談・お問い合わせフォーム">
      {!configured && <NotConfiguredNotice />}
      <Honeypot />

      <Field id="company" label="企業名・店舗名" required error={e.company}>
        <input {...aria("company", e.company)} type="text" autoComplete="organization" className="field-input" placeholder="例）株式会社〇〇／〇〇食堂" />
      </Field>

      <Field id="email" label="メールアドレス" required error={e.email}>
        <input {...aria("email", e.email)} type="email" autoComplete="email" inputMode="email" className="field-input" placeholder="例）info@example.com" />
      </Field>

      <Field id="purpose" label="PRの目的" error={e.purpose} as="fieldset">
        <ChoiceGroup name="purpose" options={purposeOptions} />
      </Field>

      <Field id="budget" label="ご予算" error={e.budget} as="fieldset">
        <ChoiceGroup name="budget" options={budgetOptions} defaultValue={initialBudget} columns={4} />
      </Field>

      <Field id="message" label="ご相談内容" error={e.message} hint="PRしたい商品やお店、ご希望の時期など、わかる範囲でご記入ください。">
        <textarea
          {...aria("message", e.message, true)}
          rows={5}
          className="field-input resize-y"
          placeholder="例）新メニューを札幌の20〜30代に知ってもらいたい。来月中旬に投稿してほしい など"
        />
      </Field>

      <details open={detailsOpen} className="group rounded-2xl border border-line bg-white">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm font-bold [&::-webkit-details-marker]:hidden">
          <span>
            詳しく入力する<span className="ml-2 text-xs font-normal text-muted">（任意：ご担当者名・業種・希望インフルエンサーなど）</span>
          </span>
          <ChevronDown size={18} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-8 border-t border-line px-5 pt-6 pb-7">
          <div className="grid gap-8 md:grid-cols-2">
            <Field id="name" label="ご担当者名" error={e.name}>
              <input {...aria("name", e.name)} type="text" autoComplete="name" className="field-input" placeholder="例）山田 太郎" />
            </Field>
            <Field id="industry" label="業種" error={e.industry}>
              <select {...aria("industry", e.industry)} className="field-input" defaultValue="">
                <option value="">選択してください</option>
                {industryOptions.map((o) => (
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
        </div>
      </details>

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
          無料で相談する
        </SubmitButton>
        <p className="text-center text-xs leading-relaxed text-muted">
          ご相談・お見積もりは無料です。内容を確認のうえ、担当者よりご連絡いたします。
        </p>
      </div>
    </form>
  );
}
