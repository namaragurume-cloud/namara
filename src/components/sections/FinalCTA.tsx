import { site } from "@/data/site";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";

export function FinalCTA() {
  return (
    <section aria-labelledby="final-cta-title" className="relative isolate overflow-hidden bg-ink py-24 text-white md:py-36">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute -top-1/3 -right-1/4 h-[140%] w-[70%] rounded-full bg-brand/35 blur-[120px]" />
        <div className="absolute -bottom-1/2 -left-1/4 h-[120%] w-[60%] rounded-full bg-brand/15 blur-[120px]" />
        <p className="num absolute -bottom-[0.2em] left-1/2 -translate-x-1/2 text-[20vw] leading-none font-extrabold tracking-tighter whitespace-nowrap text-white/[0.04]">
          CONTACT
        </p>
      </div>
      <div className="container-x text-center">
        <ScrollReveal>
          <p className="num text-xs font-semibold tracking-[0.3em] text-white/60">CONTACT</p>
          <h2 id="final-cta-title" className="heading-lg mx-auto mt-6 max-w-4xl text-[clamp(1.75rem,1.1rem+2.8vw,3.5rem)]">
            北海道のグルメPR、
            <br />
            まずはご相談ください。
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-[15px] leading-[2.1] text-white/75">
            初めてのインフルエンサーPRも、複数人を起用したキャンペーンも。
            <br className="hidden md:block" />
            目的やご予算をお伺いし、最適なプランをご提案します。
          </p>
          <ul className="mt-8 flex flex-wrap justify-center gap-2.5" aria-label="ご相談の条件">
            {["ご予算3万円〜相談可能", "無料お見積もり", "企画が未定でもOK"].map((t) => (
              <li key={t} className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[13px] font-bold">
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
            <CTAButton href="/contact" size="lg" trackLocation="final_cta">
              無料でPRプランを相談する
            </CTAButton>
            <CTAButton href={site.instagram.dmUrl} size="lg" variant="outline-light" icon="instagram" trackLocation="final_cta">
              Instagram DMで相談
            </CTAButton>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
