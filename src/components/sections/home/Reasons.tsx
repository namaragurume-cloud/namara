import { reasons } from "@/data/reasons";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { Photo } from "@/components/ui/Photo";
import { SectionLabel } from "@/components/ui/SectionHeading";

export function Reasons() {
  return (
    <section aria-labelledby="reasons-title" className="section bg-white">
      <div className="container-x grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+48px)] lg:self-start">
          <ScrollReveal>
            <SectionLabel>WHY KITACRE</SectionLabel>
            <h2 id="reasons-title" className="heading-lg mt-5">
              なぜ、
              <br className="hidden lg:block" />
              KITACREが
              <br />
              選ばれるのか。
            </h2>
            <p className="lead mt-6">
              北海道の食に向き合ってきたメディアだからこそできる、5つの強みがあります。
            </p>
            <p aria-hidden="true" className="num mt-10 hidden text-[9rem] leading-none font-extrabold tracking-tighter text-mist lg:block">
              05
            </p>
          </ScrollReveal>
        </div>

        <ol className="space-y-6 md:space-y-8">
          {reasons.map((r) => (
            <ScrollReveal
              as="li"
              key={r.no}
              className="group grid gap-6 rounded-[24px] border border-line bg-white p-6 transition-shadow duration-500 hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.25)] sm:grid-cols-[180px_1fr] md:p-8"
            >
              <Photo
                image={r.image}
                tone={Number(r.no) % 2 ? "dark" : "warm"}
                sizes="(min-width: 640px) 180px, 100vw"
                className="aspect-[16/10] rounded-2xl sm:aspect-square"
                imgClassName="transition-transform duration-700 ease-out-expo group-hover:scale-105"
              />
              <div className="flex flex-col justify-center">
                <p className="num flex items-baseline gap-2 text-brand">
                  <span className="text-[11px] font-semibold tracking-[0.25em]">REASON</span>
                  <span className="text-3xl font-extrabold">{r.no}</span>
                </p>
                <h3 className="heading-md mt-2">{r.title}</h3>
                <p className="mt-3 text-[15px] leading-[1.95] text-muted">{r.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
