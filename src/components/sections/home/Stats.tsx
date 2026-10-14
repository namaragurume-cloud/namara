import { stats } from "@/data/site";
import { CountUp } from "@/components/animation/CountUp";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { SectionLabel } from "@/components/ui/SectionHeading";

export function Stats() {
  return (
    <section aria-labelledby="stats-title" className="relative bg-white pb-20 md:pb-28">
      <div className="container-x">
        <div className="border-t border-line pt-20 md:pt-28" />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionLabel>NUMBERS</SectionLabel>
            <h2 id="stats-title" className="heading-md mt-4">
              数字で見る、MIRATSUMUの発信者ネットワーク
            </h2>
          </div>
          <p className="text-xs text-muted">
            ※{stats.asOf ? `${stats.asOf}時点の数値です。` : "数値は集計時点のものです。"}
            {stats.footnote && (
              <>
                <br />※{stats.footnote}
              </>
            )}
          </p>
        </div>

        <dl className="mt-12 grid border-t border-line md:grid-cols-3">
          {stats.items.map((s, i) => (
            <ScrollReveal
              key={s.label}
              delay={i * 0.12}
              className="flex flex-col-reverse justify-end border-b border-line py-10 md:border-b-0 md:px-10 md:py-12 md:first:pl-0 md:[&+&]:border-l"
            >
              <dt className="mt-4">
                <span className="block text-[15px] font-bold">{s.label}</span>
                {s.note && <span className="mt-1 block text-xs leading-relaxed text-muted">{s.note}</span>}
              </dt>
              <dd className="flex items-baseline font-extrabold text-ink">
                {s.prefix && <span className="mr-1 text-2xl md:text-3xl">{s.prefix}</span>}
                <span className="num text-[clamp(3.5rem,2.5rem+3.5vw,5.5rem)] leading-none text-brand">
                  <CountUp value={s.value} decimals={s.decimals} />
                </span>
                <span className="ml-1 text-2xl md:text-3xl">{s.suffix}</span>
              </dd>
            </ScrollReveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
