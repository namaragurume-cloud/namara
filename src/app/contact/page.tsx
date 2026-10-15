import Link from "next/link";
import { Suspense } from "react";
import { CircleCheck, MessageCircle } from "lucide-react";
import { site } from "@/data/site";
import { isMailConfigured } from "@/lib/mail";
import { pageMetadata } from "@/lib/metadata";
import { ContactForm } from "@/components/forms/ContactForm";
import { CTAButton } from "@/components/ui/CTAButton";
import { PageHero } from "@/components/ui/PageHero";

export const metadata = pageMetadata({
  title: "無料相談・お見積もり",
  description:
    "北海道のインフルエンサーPR・グルメPRのご相談・お見積もりは無料です。企画や予算が決まっていなくても大丈夫。飲食店・食品メーカー・宿泊施設・観光施設のご担当者様はお気軽にご相談ください。ご予算3万円から相談可能。",
  path: "/contact",
});

const consultPoints = [
  "自社に合うインフルエンサーの候補",
  "予算に合ったPR施策",
  "効果的な投稿・発信方法",
  "実施までの流れ",
];

export default function ContactPage() {
  const configured = isMailConfigured("contact");
  return (
    <>
      <PageHero
        en="CONTACT"
        title={
          <>
            <span className="inline-block">北海道のグルメPR、</span>
            <span className="inline-block">まずは無料で</span>
            <span className="inline-block">ご相談ください。</span>
          </>
        }
        lead="まだ企画や予算が決まっていなくても大丈夫です。PRの目的やご予算に合わせて、最適な発信方法をご提案します。"
        breadcrumb={[{ label: "お問い合わせ", href: "/contact" }]}
      >
        <div className="mt-10 rounded-[24px] bg-white p-6 md:p-8">
          <p className="text-sm font-bold">無料相談でわかること</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {consultPoints.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[14px] leading-relaxed font-bold">
                <CircleCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-muted">
            ご相談・お見積もりは無料です。ご予算3万円からご相談いただけます。
          </p>
        </div>
      </PageHero>
      <section className="section pt-16! md:pt-24!">
        <div className="container-x grid gap-14 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-16">
          <div>
            <Suspense fallback={<div className="min-h-[900px]" aria-hidden="true" />}>
              <ContactForm configured={configured} />
            </Suspense>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-[calc(var(--header-h)+32px)] lg:self-start">
            <div className="rounded-[24px] bg-ink p-7 text-white">
              <p className="flex items-center gap-2 font-bold">
                <MessageCircle size={20} aria-hidden="true" />
                Instagram DMでもご相談いただけます
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                「まずは気軽に聞いてみたい」という方は、運営メディア「なまらグルメ」の公式Instagram（{site.instagram.handle}）へメッセージをお送りください。
              </p>
              <CTAButton href={site.instagram.dmUrl} variant="light" icon="instagram" fullWidth className="mt-6" trackLocation="contact_aside">
                Instagram DMで相談する
              </CTAButton>
            </div>
            <div className="rounded-[24px] border border-line p-7">
              <p className="font-bold">ご相談の例</p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
                <li>新店舗OPENにあわせて告知したい</li>
                <li>新メニュー・新商品をPRしたい</li>
                <li>3万円の予算で何ができるか知りたい</li>
                <li>複数のインフルエンサーを起用したい</li>
                <li>試食会・PRイベントを開催したい</li>
              </ul>
            </div>
            <p className="px-2 text-xs leading-relaxed text-muted">
              インフルエンサーとしての登録をご希望の方は、
              <Link href="/partner" className="underline underline-offset-4">
                インフルエンサー登録ページ
              </Link>
              からお申し込みください。
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
