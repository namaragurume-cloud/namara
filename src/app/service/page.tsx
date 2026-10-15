import { Check } from "lucide-react";
import { images } from "@/data/images";
import { platforms, services } from "@/data/services";
import { site } from "@/data/site";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl } from "@/lib/utils";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Flow } from "@/components/sections/Flow";
import { CTAButton } from "@/components/ui/CTAButton";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/ui/PageHero";
import { Photo } from "@/components/ui/Photo";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata = pageMetadata({
  title: "サービス内容｜北海道のインフルエンサーPR・キャスティング",
  description:
    "北海道・札幌のグルメインフルエンサーキャスティング、PR企画、投稿スケジュール管理、投稿内容の確認、効果測定レポート、イベント企画まで。飲食店の集客や新商品PRをワンストップでサポートします。",
  path: "/service",
});

export default function ServicePage() {
  return (
    <>
      <PageHero
        en="SERVICE"
        title={
          <>
            北海道のグルメPRを、
            <br className="hidden md:block" />
            企画から発信までワンストップで。
          </>
        }
        lead={
          <>
            <p>札幌を中心に、グルメに特化した総フォロワー数115万人以上の発信者ネットワークを活用。</p>
            <p className="mt-2">
              フォロワー10万人を超える大型インフルエンサーから、地域に密着したマイクロインフルエンサーまで、商品や店舗の目的・予算に合わせたPRをご提案します。
            </p>
          </>
        }
        breadcrumb={[{ label: "サービス紹介", href: "/service" }]}
      />

      <div className="container-x -mt-2 md:-mt-6">
        <Photo
          image={images.serviceHero}
          priority
          sizes="(min-width: 1240px) 1160px, 100vw"
          className="aspect-square rounded-[28px] bg-[#faf9f6] md:aspect-[21/9]"
          imgClassName="object-contain!"
        />
      </div>

      {/* サービス目次 */}
      <nav aria-label="サービス一覧" className="container-x mt-14">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {services.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex h-full min-h-14 items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm font-bold transition-colors hover:border-ink"
              >
                <span className="num text-brand">{s.no}</span>
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-label="サービス詳細" className="section pt-20! md:pt-28!">
        <div className="container-x space-y-6 md:space-y-8">
          {services.map((s) => {
            const Icon = s.icon;
            return (
              <ScrollReveal
                as="article"
                key={s.id}
                className="grid scroll-mt-28 gap-10 rounded-[28px] bg-mist p-7 md:p-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
              >
                <div id={s.id} className="scroll-mt-32">
                  <div className="flex items-center gap-4">
                    <span className="grid size-14 place-items-center rounded-2xl bg-white">
                      <Icon size={26} strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    <span className="num text-5xl font-extrabold text-ink/10">{s.no}</span>
                  </div>
                  <p className="num mt-8 text-[11px] font-semibold tracking-[0.25em] text-brand">{s.en}</p>
                  <h2 className="heading-md mt-2 text-2xl md:text-[1.75rem]">{s.title}</h2>
                  <p className="mt-4 text-[15px] leading-[2] text-muted">{s.summary}</p>
                </div>
                <div className="space-y-5">
                  <div className="rounded-2xl bg-white p-6 md:p-8">
                    <h3 className="text-sm font-bold text-muted">主な内容</h3>
                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                      {s.items.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-[15px]">
                          <Check size={18} aria-hidden="true" className="mt-1 shrink-0 text-brand" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {s.extra && (
                    <div className="rounded-2xl bg-white p-6 md:p-8">
                      <h3 className="text-sm font-bold text-muted">{s.extra.title}</h3>
                      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
                        {s.extra.items.map((item, i) => (
                          <li key={item} className="flex items-start gap-3 text-[15px]">
                            <span className="num mt-0.5 text-sm font-bold text-brand">{String(i + 1).padStart(2, "0")}</span>
                            {item}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {s.note && <p className="text-xs leading-relaxed text-muted">※{s.note}</p>}
                </div>
              </ScrollReveal>
            );
          })}
        </div>
        <div className="container-x mt-12 flex flex-col items-center gap-4 text-center md:mt-16">
          <p className="text-lg font-bold md:text-xl">どのサービスが合うかわからない場合も、お気軽にご相談ください。</p>
          <CTAButton href="/contact" size="lg" trackLocation="service_list">
            {site.cta}
          </CTAButton>
        </div>
      </section>

      <section aria-label="対応SNS" className="section bg-ink text-white">
        <div className="container-x">
          <SectionHeading
            theme="dark"
            en="PLATFORM"
            title="対応SNS"
            lead="商材やPRの目的に合わせて、最適な媒体と投稿形式をご提案します。"
          />
          <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 md:mt-20">
            {platforms.map((p, i) => (
              <ScrollReveal
                as="li"
                key={`${p.name}-${p.format}`}
                delay={i * 0.08}
                className="flex flex-col rounded-[24px] border border-white/10 bg-white/[0.04] p-7 transition-colors duration-500 hover:bg-white/[0.08]"
              >
                <p className="num text-xs font-semibold tracking-[0.2em] text-white/50">{p.name.toUpperCase()}</p>
                <h3 className="mt-2 text-xl font-bold">{p.format}</h3>
                <p className="mt-4 text-sm leading-[1.95] text-white/65">{p.description}</p>
              </ScrollReveal>
            ))}
          </ul>
        </div>
      </section>

      <Flow />
      <FinalCTA />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: "グルメインフルエンサーキャスティング",
          serviceType: "インフルエンサーマーケティング",
          description: site.description,
          url: absoluteUrl("/service"),
          areaServed: { "@type": "AdministrativeArea", name: "北海道" },
          provider: { "@id": `${site.url}/#organization` },
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "サービス一覧",
            itemListElement: services.map((s) => ({
              "@type": "Offer",
              itemOffered: { "@type": "Service", name: s.title, description: s.summary },
            })),
          },
        }}
      />
    </>
  );
}
