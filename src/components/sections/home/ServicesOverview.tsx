import { services } from "@/data/services";
import { site } from "@/data/site";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ServiceCard } from "@/components/ui/ServiceCard";

export function ServicesOverview() {
  return (
    <section aria-label="MIRATSUMUでできること" className="section relative isolate overflow-hidden bg-mist">
      <div aria-hidden="true" className="bg-glow absolute inset-0 -z-10 opacity-70" />
      <div className="container-x">
        <SectionHeading
          en="SERVICE"
          title={
            <>
              <span className="inline-block">企画から効果報告まで、</span>
              <span className="inline-block">ワンストップでサポート。</span>
            </>
          }
          lead="インフルエンサーの選定からPR企画、投稿の進行管理、実施後のレポートまで。北海道のグルメPRに必要なことを、まとめてお任せいただけます。"
        />

        <ul className="mt-12 grid gap-4 md:mt-16 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {services.map((s, i) => (
            <ScrollReveal as="li" key={s.id} delay={(i % 3) * 0.08}>
              <ServiceCard service={s} />
            </ScrollReveal>
          ))}
        </ul>

        <ScrollReveal className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center md:mt-16">
          <CTAButton href="/contact" size="lg" trackLocation="home_service">
            {site.cta}
          </CTAButton>
          <CTAButton href="/service" size="lg" variant="outline" trackLocation="home_service">
            サービス詳細を見る
          </CTAButton>
        </ScrollReveal>
      </div>
    </section>
  );
}
