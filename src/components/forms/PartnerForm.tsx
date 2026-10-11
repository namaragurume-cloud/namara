"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";
import { genreOptions, partnerSchema } from "@/lib/validation";
import { aria, Checkbox, Field, Honeypot } from "./fields";
import { ErrorSummary, NotConfiguredNotice, SubmitButton, SuccessPanel } from "./FormParts";
import { Turnstile } from "./Turnstile";
import { useFormSubmit } from "./useFormSubmit";

const val = (form: HTMLFormElement, name: string) =>
  ((form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "").trim();

const checked = (form: HTMLFormElement, name: string) =>
  (form.elements.namedItem(name) as HTMLInputElement | null)?.checked ?? false;

export function PartnerForm({ configured }: { configured: boolean }) {
  const { status, errors, message, onSubmit, markStarted } = useFormSubmit({
    endpoint: "/api/partner",
    schema: partnerSchema,
    collect: (f) => ({
      account: val(f, "account"),
      email: val(f, "email"),
      snsUrl: val(f, "snsUrl"),
      followers: val(f, "followers").replace(/[,，\s]/g, ""),
      area: val(f, "area"),
      genres: [...f.querySelectorAll<HTMLInputElement>('input[name="genres"]:checked')].map((i) => i.value),
      genreOther: val(f, "genreOther"),
      message: val(f, "message"),
      review: checked(f, "review"),
      privacy: checked(f, "privacy"),
    }),
    onSuccess: () => track("partner_apply", { form: "partner" }),
  });

  if (status === "success") {
    return (
      <SuccessPanel title="登録申請を受け付けました">
        <p>ご応募いただき、ありがとうございます。</p>
        <p>
          ※この時点では登録は完了していません。なまらグルメにて内容を確認・審査のうえ、ご入力いただいたメールアドレス宛に結果をご連絡いたします。
        </p>
      </SuccessPanel>
    );
  }

  const e = errors;
  return (
    <form noValidate onSubmit={onSubmit} onFocus={markStarted} className="relative space-y-8" aria-label="インフルエンサー登録フォーム">
      {!configured && <NotConfiguredNotice />}
      <Honeypot />

      <div className="grid gap-8 md:grid-cols-2">
        <Field id="account" label="活動名・アカウント名" required error={e.account}>
          <input {...aria("account", e.account)} type="text" className="field-input" placeholder="例）@namaragurume" />
        </Field>
        <Field id="email" label="メールアドレス" required error={e.email} hint="審査結果のご連絡に使用します">
          <input {...aria("email", e.email, true)} type="email" autoComplete="email" inputMode="email" className="field-input" placeholder="例）info@example.com" />
        </Field>
      </div>

      <Field id="snsUrl" label="InstagramまたはTikTokのURL" required error={e.snsUrl}>
        <input {...aria("snsUrl", e.snsUrl)} type="url" inputMode="url" className="field-input" placeholder="https://www.instagram.com/your_account/" />
      </Field>

      <div className="grid gap-8 md:grid-cols-2">
        <Field id="followers" label="フォロワー数" required error={e.followers} hint="登録条件：1,000人以上">
          <input
            {...aria("followers", e.followers, true)}
            type="text"
            inputMode="numeric"
            className="field-input"
            placeholder="例）12000"
          />
        </Field>
        <Field id="area" label="活動エリア" required error={e.area}>
          <input {...aria("area", e.area)} type="text" className="field-input" placeholder="例）札幌市、道央エリア など" />
        </Field>
      </div>

      <Field id="genres" label="得意なグルメジャンル（複数選択可）" required error={e.genres} as="fieldset">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {genreOptions.map((g) => (
            <Checkbox key={g} name="genres" value={g} error={e.genres}>
              {g}
            </Checkbox>
          ))}
        </div>
        <input
          {...aria("genreOther", e.genreOther)}
          aria-label="その他のジャンル（任意）"
          type="text"
          className="field-input mt-3"
          placeholder="「その他」の内容（任意）"
        />
      </Field>

      <Field id="message" label="自己PR・実績など" error={e.message}>
        <textarea {...aria("message", e.message)} rows={5} className="field-input resize-y" placeholder="得意な発信スタイル、これまでのPR実績などをご自由にご記入ください。" />
      </Field>

      <Field id="agreements" label="同意事項" required error={e.review || e.privacy} as="fieldset">
        <div className="space-y-1">
          <Checkbox name="review" error={e.review}>
            登録内容の確認・審査に同意する
          </Checkbox>
          <Checkbox name="privacy" error={e.privacy}>
            <Link href="/privacy" target="_blank" className="font-bold underline underline-offset-4 hover:text-brand">
              プライバシーポリシー
            </Link>
            に同意する
          </Checkbox>
        </div>
      </Field>

      <Turnstile />
      <ErrorSummary message={message} />

      <div className="flex flex-col items-center gap-4 pt-2">
        <SubmitButton submitting={status === "submitting"} disabled={!configured}>
          登録を申請する
        </SubmitButton>
        <p className="text-center text-xs leading-relaxed text-muted">
          フォームの送信だけでは登録は完了しません。審査のうえ、結果をご連絡します。
        </p>
      </div>
    </form>
  );
}
