import { Check, Info } from "lucide-react";
import { plans, pricingPolicy } from "@/data/pricing";
import { pageMetadata } from "@/lib/metadata";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { PageHero } from "@/components/ui/PageHero";
import { PricingCard } from "@/components/ui/PricingCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FAQAccordion } from "@/components/ui/FAQAccordion";
import { faq } from "@/data/faq";

export const metadata = pageMetadata({
  title: "料金",
  description:
    "北海道のグルメインフルエンサーPRの料金。ご予算3万円からご相談いただけます。インフルエンサー1名プラン、複数人キャスティングプラン、オーダーメイドプランをご用意しています。",
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <>
      <PageHero
        en="PRICING"
        title={
          <>
            ご予算に合わせた、
            <br className="hidden md:block" />
            柔軟なインフルエンサーPR。
          </>
        }
        lead="起用する発信者のフォロワー規模・人数・投稿形式・PR内容に応じて、ご予算に合わせたプランをご提案します。"
        breadcrumb={[{ label: "料金", href: "/pricing" }]}
      />

      <section aria-label="料金の考え方" className="section pb-0!">
        <div className="container-x grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <ScrollReveal className="flex flex-col justify-center rounded-[28px] bg-ink p-8 text-white md:p-12">
            <p className="text-sm font-bold text-white/60">ご予算の目安</p>
            <p className="mt-2 flex items-baseline gap-1 font-extrabold">
              <span className="num text-7xl text-brand md:text-8xl">3</span>
              <span className="text-2xl md:text-3xl">万円〜</span>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-white/70">{pricingPolicy.minimumOrderNote}</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="flex flex-col justify-center">
            <h2 className="heading-md">料金の考え方</h2>
            <ul className="mt-6 space-y-4">
              {pricingPolicy.points.map((p) => (
                <li key={p} className="flex items-start gap-3 border-b border-line pb-4 text-[15px]">
                  <Check size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />
                  {p}
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </div>
      </section>

      <section aria-label="料金プラン" className="section">
        <div className="container-x">
          <SectionHeading en="PLAN" title="料金プラン" />
          <ul className="mt-12 grid gap-5 lg:grid-cols-3 md:mt-16">
            {plans.map((p, i) => (
              <ScrollReveal as="li" key={p.id} delay={i * 0.1}>
                <PricingCard plan={p} featured={i === 1} />
              </ScrollReveal>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="注意事項" className="section pt-0!">
        <div className="container-x max-w-4xl!">
          <ScrollReveal className="rounded-[24px] border border-line p-7 md:p-10">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Info size={20} aria-hidden="true" className="text-brand" />
              ご注意事項
            </h2>
            <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-[1.95] text-muted">
              <li>{pricingPolicy.disclaimer}</li>
              {pricingPolicy.taxNote && <li>{pricingPolicy.taxNote}</li>}
              <li>料金に含まれる作業範囲は、ご契約前に明示いたします。</li>
              <li>投稿写真・動画の二次利用は、媒体や期間に応じて発信者の許諾や追加料金が必要になる場合があります。</li>
            </ul>
          </ScrollReveal>

          <div className="mt-16">
            <h2 className="heading-md">料金に関するよくある質問</h2>
            <div className="mt-6">
              <FAQAccordion items={faq.filter((f) => /複数人|二次利用|初めて/.test(f.q))} />
            </div>
          </div>

          <div className="mt-16 flex flex-col items-center gap-4 rounded-[28px] bg-mist p-8 text-center md:p-14">
            <p className="text-xl font-bold md:text-2xl">ご予算に合わせて、最適な組み合わせをご提案します。</p>
            <p className="text-sm text-muted">「この予算で何ができる？」というご相談も歓迎です。</p>
            <CTAButton href="/contact" size="lg" trackLocation="pricing" className="mt-4">
              予算に合わせたプランを相談する
            </CTAButton>
          </div>
        </div>
      </section>
    </>
  );
}
