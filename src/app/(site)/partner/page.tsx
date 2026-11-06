import { Check } from "lucide-react";
import { images } from "@/data/images";
import { isMailConfigured } from "@/lib/mail";
import { pageMetadata } from "@/lib/metadata";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { PartnerForm } from "@/components/forms/PartnerForm";
import { PageHero } from "@/components/ui/PageHero";
import { Photo } from "@/components/ui/Photo";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata = pageMetadata({
  title: "インフルエンサー登録",
  description:
    "北海道のグルメ情報を発信するインフルエンサーを募集しています。飲食店や食品メーカーのPR案件、新商品・新店舗の紹介、グルメイベントへの参加など、発信力を活かせる機会をご案内します。",
  path: "/partner",
});

const conditions = [
  "北海道のグルメ情報を発信していること",
  "InstagramまたはTikTokのフォロワーが1,000人以上",
  "登録内容の確認・審査に同意すること",
];

const merits = [
  { no: "01", title: "PR案件の紹介", body: "企業や飲食店のPR案件をご案内します。" },
  { no: "02", title: "新商品・新店舗のPR機会", body: "新しい商品や店舗に関する発信機会をご案内します。" },
  { no: "03", title: "グルメイベント・試食会", body: "イベントや試食会への参加機会をご案内します。" },
];

const steps = [
  "登録フォーム送信",
  "MIRATSUMUによる内容確認",
  "審査",
  "審査結果・必要な案内の連絡",
  "登録承認後、条件の合う案件を個別にご案内",
];

export default function PartnerPage() {
  const configured = isMailConfigured("partner");
  return (
    <>
      <PageHero
        en="FOR CREATORS"
        title={
          <>
            あなたの「北海道グルメが好き」を、
            <br className="hidden lg:block" />
            新しいチャンスに。
          </>
        }
        lead={
          <>
            <p>MIRATSUMUでは、北海道のグルメ情報を発信するインフルエンサーを募集しています。</p>
            <p className="mt-2">
              飲食店や食品メーカーのPR案件、新商品・新店舗の紹介、グルメイベントへの参加など、あなたの発信力を活かせる機会をご案内します。
            </p>
          </>
        }
        breadcrumb={[{ label: "インフルエンサー登録", href: "/partner" }]}
      />

      <section aria-label="登録メリット" className="section">
        <div className="container-x grid gap-14 lg:grid-cols-2 lg:gap-20">
          <ScrollReveal>
            <Photo image={images.partnerHero} tone="warm" sizes="(min-width: 1024px) 45vw, 100vw" className="aspect-[4/3] rounded-[28px]" />
          </ScrollReveal>
          <div>
            <SectionHeading en="MERIT" title="登録のメリット" />
            <ul className="mt-10 space-y-4">
              {merits.map((m, i) => (
                <ScrollReveal as="li" key={m.no} delay={i * 0.08} className="flex gap-5 rounded-2xl bg-mist p-6">
                  <span className="num text-2xl font-extrabold text-brand">{m.no}</span>
                  <div>
                    <h3 className="font-bold">{m.title}</h3>
                    <p className="mt-1 text-sm text-muted">{m.body}</p>
                  </div>
                </ScrollReveal>
              ))}
            </ul>
            <p className="mt-5 text-xs text-muted">※案件のご紹介やイベントへの参加を保証するものではありません。</p>
          </div>
        </div>
      </section>

      <section aria-label="登録条件と流れ" className="section bg-mist">
        <div className="container-x grid gap-8 lg:grid-cols-2">
          <ScrollReveal className="rounded-[28px] bg-white p-8 md:p-12">
            <h2 className="heading-md">登録条件</h2>
            <ul className="mt-6 space-y-4">
              {conditions.map((c) => (
                <li key={c} className="flex items-start gap-3 text-[15px]">
                  <Check size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />
                  {c}
                </li>
              ))}
            </ul>
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="rounded-[28px] bg-white p-8 md:p-12">
            <h2 className="heading-md">登録までの流れ</h2>
            <ol className="mt-6 space-y-4">
              {steps.map((s, i) => (
                <li key={s} className="flex items-center gap-4 text-[15px]">
                  <span className="num grid size-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <p className="mt-6 text-xs text-muted">※フォームの送信だけでは登録完了となりません。</p>
          </ScrollReveal>
        </div>
      </section>

      <section aria-labelledby="partner-form-title" className="section">
        <div className="container-x max-w-4xl!">
          <SectionHeading en="ENTRY" title={<span id="partner-form-title">登録申請フォーム</span>} />
          <div className="mt-12">
            <PartnerForm configured={configured} />
          </div>
        </div>
      </section>
    </>
  );
}
