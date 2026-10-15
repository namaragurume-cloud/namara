import { pains } from "@/data/pains";
import { site } from "@/data/site";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { SectionHeading } from "@/components/ui/SectionHeading";

/** トップページ：こんなお悩みはありませんか？ */
export function PainsSection() {
  return (
    <section aria-labelledby="pains-title" className="section bg-white">
      <div className="container-x">
        <SectionHeading
          en="PROBLEMS"
          align="center"
          title={<span id="pains-title">こんなお悩みはありませんか？</span>}
          lead="北海道の飲食店・食品メーカー・宿泊施設のご担当者様から、よくいただくご相談です。"
        />
        <ul className="mx-auto mt-12 grid max-w-5xl gap-3 sm:grid-cols-2 md:mt-16 md:gap-4 lg:grid-cols-3">
          {pains.map(({ icon: Icon, text }, i) => (
            <ScrollReveal
              as="li"
              key={text}
              delay={(i % 3) * 0.06}
              className="flex items-center gap-4 rounded-[20px] border border-line bg-white p-5 md:p-6"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-mist text-brand">
                <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="text-[15px] leading-relaxed font-bold">{text}</span>
            </ScrollReveal>
          ))}
        </ul>

        <ScrollReveal className="mx-auto mt-12 flex max-w-5xl flex-col items-center gap-6 rounded-[28px] bg-ink px-6 py-10 text-center text-white md:mt-16 md:flex-row md:justify-between md:px-12 md:text-left">
          <p className="text-xl leading-relaxed font-bold md:text-2xl">
            そのお悩み、
            <br className="md:hidden" />
            <span className="text-brand">MIRATSUMU</span>にご相談ください。
          </p>
          <CTAButton href="/contact" trackLocation="home_pains" className="shrink-0">
            {site.cta}
          </CTAButton>
        </ScrollReveal>
      </div>
    </section>
  );
}
