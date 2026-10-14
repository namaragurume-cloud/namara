import Image from "next/image";
import { brand } from "@/data/brand";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { SectionLabel } from "@/components/ui/SectionHeading";

/** トップページ：MIRATSUMU とは */
export function BrandConcept() {
  const [first, second] = brand.slogan.split("、");
  return (
    <section aria-labelledby="brand-title" className="section overflow-hidden bg-white">
      <div className="container-x grid items-center gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <ScrollReveal className="relative mx-auto w-full max-w-[420px]">
          <div aria-hidden="true" className="absolute inset-[8%] rounded-full bg-brand/10 blur-3xl" />
          <div className="relative aspect-square rounded-full border border-line bg-white p-[17%] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.25)]">
            <Image
              src="/images/brand/miratsumu-symbol.png"
              alt="MIRATSUMUのシンボルマーク（交差しながら一つの輪を描く2本の曲線）"
              width={400}
              height={361}
              sizes="(min-width: 1024px) 300px, 60vw"
              className="h-full w-full object-contain"
            />
          </div>
        </ScrollReveal>

        <div>
          <ScrollReveal>
            <SectionLabel>ABOUT MIRATSUMU</SectionLabel>
            <h2 id="brand-title" className="heading-lg mt-5">
              {first}、
              <br />
              <span className="text-brand">{second}</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="lead mt-8 space-y-4 text-ink/75">
            <p>{brand.nameOrigin}</p>
          </ScrollReveal>
          <ScrollReveal delay={0.15} className="mt-8 border-l-2 border-brand pl-5">
            {brand.innovation.map((l) => (
              <p key={l} className="text-[15px] leading-[2] font-bold md:text-base">
                {l}
              </p>
            ))}
          </ScrollReveal>
          <ScrollReveal delay={0.2} className="mt-10">
            <CTAButton href="/about" variant="outline" trackLocation="home_brand">
              MIRATSUMUについて
            </CTAButton>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
