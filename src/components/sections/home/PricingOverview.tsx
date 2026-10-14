import { plans, pricingPolicy } from "@/data/pricing";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { PricingCard } from "@/components/ui/PricingCard";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function PricingOverview() {
  return (
    <section aria-label="料金" className="section bg-mist">
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <SectionHeading
            en="PRICING"
            title={
              <>
                ご予算に合わせて、
                <br />
                最適なグルメPRを。
              </>
            }
            lead="インフルエンサーへの報酬を含んだ総額でご提示します。起用人数・投稿形式・PR内容に応じて、ご予算に合わせた組み合わせをご提案します。"
          />
          <ScrollReveal className="rounded-[24px] bg-white px-8 py-7 lg:min-w-[300px]">
            <p className="text-xs font-bold text-muted">ご予算の目安</p>
            <p className="mt-1 flex items-baseline gap-1 font-extrabold">
              <span className="num text-5xl text-brand">3</span>
              <span className="text-xl">万円〜</span>
            </p>
            <p className="mt-2 text-xs text-muted">{pricingPolicy.minimumOrderNote}</p>
          </ScrollReveal>
        </div>

        <ul className="mt-14 grid gap-5 md:mt-20 lg:grid-cols-3">
          {plans.map((p, i) => (
            <ScrollReveal as="li" key={p.id} delay={i * 0.1}>
              <PricingCard plan={p} featured={i === 1} />
            </ScrollReveal>
          ))}
        </ul>

        <div className="mt-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <p className="max-w-2xl text-xs leading-relaxed text-muted">※{pricingPolicy.disclaimer}</p>
          <CTAButton href="/pricing" variant="outline" trackLocation="home_pricing" className="shrink-0">
            料金を見る
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
