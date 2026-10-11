import { services } from "@/data/services";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ServiceCard } from "@/components/ui/ServiceCard";

export function ServicesOverview() {
  return (
    <section aria-label="サービス紹介" className="section bg-mist">
      <div className="container-x">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            en="SERVICE"
            title={
              <>
                企画から効果報告まで、
                <br />
                ワンストップで。
              </>
            }
            lead="PR企画、発信者の選定、投稿管理、実施後のレポートまで。グルメPRに必要なことを一貫してサポートします。"
          />
          <ScrollReveal className="shrink-0">
            <CTAButton href="/service" variant="outline" trackLocation="home_service">
              詳しく見る
            </CTAButton>
          </ScrollReveal>
        </div>

        <ul className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-6 md:mt-20">
          {services.map((s, i) => (
            <ScrollReveal
              as="li"
              key={s.id}
              delay={(i % 3) * 0.08}
              className={i < 3 ? "lg:col-span-2" : "lg:col-span-3"}
            >
              <ServiceCard service={s} />
            </ScrollReveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
