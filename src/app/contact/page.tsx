import Link from "next/link";
import { Suspense } from "react";
import { MessageCircle } from "lucide-react";
import { site } from "@/data/site";
import { isMailConfigured } from "@/lib/mail";
import { pageMetadata } from "@/lib/metadata";
import { ContactForm } from "@/components/forms/ContactForm";
import { CTAButton } from "@/components/ui/CTAButton";
import { PageHero } from "@/components/ui/PageHero";

export const metadata = pageMetadata({
  title: "企業向けお問い合わせ・お見積もり",
  description:
    "北海道のグルメインフルエンサーPRのご相談・お見積もりは無料です。飲食店・食品メーカー・ホテル・宿泊施設のご担当者様は、フォームまたはInstagram DMからお気軽にお問い合わせください。",
  path: "/contact",
});

export default function ContactPage() {
  const configured = isMailConfigured("contact");
  return (
    <>
      <PageHero
        en="CONTACT"
        title="無料相談・お見積もり"
        lead="インフルエンサーPRのご相談・お見積もりは無料です。目的やご予算が決まっていない段階でも、お気軽にお問い合わせください。"
        breadcrumb={[{ label: "お問い合わせ", href: "/contact" }]}
      />
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
                「まずは気軽に聞いてみたい」という方は、なまらグルメ公式アカウント（{site.instagram.handle}）へメッセージをお送りください。
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
                <li>5万円の予算で何ができるか知りたい</li>
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
