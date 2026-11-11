import { pricingPolicy } from "@/data/pricing";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { PricingTable } from "@/components/ui/PricingTable";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function PricingOverview() {
  return (
    <section aria-label="料金" className="section relative isolate overflow-hidden bg-mist">
      <div aria-hidden="true" className="bg-glow absolute inset-0 -z-10 opacity-70" />
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
            lead="フォロワー1万人未満のマイクロインフルエンサーは、人数に応じた定額。1万人以上のインフルエンサーは、条件に応じて個別にお見積もりします。"
          />
          <ScrollReveal className="rounded-[24px] bg-white px-8 py-7 lg:min-w-[300px]">
            <p className="text-xs font-bold text-muted">料金</p>
            <p className="mt-1 flex items-baseline gap-1 font-extrabold">
              <span className="num text-5xl text-brand">5</span>
              <span className="text-xl">万円〜</span>
            </p>
            <p className="mt-2 text-xs text-muted">{pricingPolicy.minimumOrderNote}</p>
          </ScrollReveal>
        </div>

        <ScrollReveal className="mt-14 md:mt-20">
          <PricingTable />
        </ScrollReveal>

        <div className="mt-10 flex justify-center">
          <CTAButton href="/pricing" variant="outline" trackLocation="home_pricing" className="shrink-0">
            料金の詳細を見る
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
