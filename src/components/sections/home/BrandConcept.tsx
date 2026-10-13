import Image from "next/image";
import { brand } from "@/data/brand";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { SectionLabel } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/utils";

/** トップページ：KITACRE とは */
export function BrandConcept() {
  return (
    <section aria-labelledby="brand-title" className="section overflow-hidden bg-white">
      <div className="container-x grid items-center gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <ScrollReveal className="relative mx-auto w-full max-w-[420px]">
          <div aria-hidden="true" className="absolute inset-[8%] rounded-full bg-brand/10 blur-3xl" />
          <div className="relative aspect-square rounded-full border border-line bg-white p-[16%] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.25)]">
            <Image
              src="/images/brand/kitacre-symbol.png"
              alt="KITACREのシンボルマーク（人と人が手を取り合う輪）"
              width={268}
              height={254}
              sizes="(min-width: 1024px) 300px, 60vw"
              className="h-full w-full object-contain"
            />
          </div>
        </ScrollReveal>

        <div>
          <ScrollReveal>
            <SectionLabel>ABOUT KITACRE</SectionLabel>
            <h2 id="brand-title" className="heading-lg mt-5">
              人と人がつながり、
              <br />
              北海道に新しい価値と幸せを。
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="lead mt-8 space-y-4 text-ink/75">
            <p>{brand.nameOrigin}</p>
            <p>{brand.symbol[0]}</p>
          </ScrollReveal>
          <ScrollReveal delay={0.15}>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="シンボルマークの4つの人物が象徴するもの">
              {brand.figures.map((f) => (
                <li key={f.en} className="flex items-center gap-3 rounded-2xl bg-mist px-4 py-3">
                  <span
                    aria-hidden="true"
                    className={cn("size-3 shrink-0 rounded-full", f.color === "red" ? "bg-brand" : "bg-ink")}
                  />
                  <span className="text-[13px] leading-snug font-bold">{f.en === "KITACRE" ? "KITACRE" : f.label}</span>
                </li>
              ))}
            </ul>
          </ScrollReveal>
          <ScrollReveal delay={0.2} className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xl font-extrabold md:text-2xl">
              <span className="text-brand">{brand.slogan.split("、")[0]}、</span>
              {brand.slogan.split("、")[1]}
            </p>
            <CTAButton href="/about" variant="outline" trackLocation="home_brand" className="shrink-0">
              KITACREについて
            </CTAButton>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
