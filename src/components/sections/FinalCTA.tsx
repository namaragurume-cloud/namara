import { site } from "@/data/site";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";

export function FinalCTA() {
  return (
    <section aria-labelledby="final-cta-title" className="bg-gradient-brand relative isolate overflow-hidden py-24 text-white md:py-36">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute -top-1/3 -right-1/4 h-[140%] w-[70%] rounded-full bg-white/20 blur-[120px]" />
        <div className="absolute -bottom-1/2 -left-1/4 h-[120%] w-[60%] rounded-full bg-[#ffb36b]/30 blur-[120px]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgb(255_255_255/0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.18)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000,transparent)]" />
        <p className="num absolute -bottom-[0.2em] left-1/2 -translate-x-1/2 text-[20vw] leading-none font-extrabold tracking-tighter whitespace-nowrap text-white/[0.08]">
          CONTACT
        </p>
      </div>
      <div className="container-x text-center">
        <ScrollReveal>
          <p className="num text-xs font-semibold tracking-[0.3em] text-white/80">CONTACT</p>
          <h2 id="final-cta-title" className="heading-lg mx-auto mt-6 max-w-4xl text-[clamp(1.75rem,1.1rem+2.8vw,3.5rem)]">
            北海道のグルメPR、
            <br />
            まずはご相談ください。
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-[15px] leading-[2.1] text-white/90">
            初めてのインフルエンサーPRも、複数人を起用したキャンペーンも。
            <br className="hidden md:block" />
            目的やご予算をお伺いし、最適なプランをご提案します。
          </p>
          <ul className="mt-8 flex flex-wrap justify-center gap-2.5" aria-label="ご相談の条件">
            {["ご予算3万円〜相談可能", "無料お見積もり", "企画が未定でもOK"].map((t) => (
              <li key={t} className="rounded-full border border-white/40 bg-white/15 px-4 py-2 text-[13px] font-bold backdrop-blur">
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
            <CTAButton href="/contact" size="lg" variant="light" trackLocation="final_cta" className="text-brand shadow-[0_14px_32px_-14px_rgba(0,0,0,0.35)]">
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
