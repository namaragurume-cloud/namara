import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { businesses, corp, corpProfile } from "@/data/corp";
import { history } from "@/data/history";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { SectionHeading } from "@/components/ui/SectionHeading";

export default function CorpHome() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-cream">
        <div aria-hidden="true" className="bg-glow absolute inset-0 -z-10 opacity-80" />
        <div className="container-x py-24 md:py-36">
          <p className="num text-xs font-semibold tracking-[0.3em] text-brand">{corp.nameEn.toUpperCase()}</p>
          <h1 className="mt-6 text-[clamp(2.25rem,1.4rem+4vw,4.5rem)] leading-[1.25] font-extrabold">
            {corp.message.lead}
            <br />
            <span className="text-brand">{corp.message.accent}</span>
          </h1>
          <p className="lead mt-8 max-w-2xl text-ink/75">{corp.intro}</p>
          <ul className="mt-10 flex flex-wrap gap-2">
            {businesses.map((b) => (
              <li key={b.id}>
                <a
                  href={`#${b.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-bold transition-colors hover:border-brand/50 hover:text-brand"
                >
                  <span className="num text-xs text-brand">{b.no}</span>
                  {b.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="business" aria-labelledby="business-title" className="section scroll-mt-24">
        <div className="container-x">
          <SectionHeading en="BUSINESS" title={<span id="business-title">事業内容</span>} lead="発信する、届ける、味わってもらう。3つの事業で北海道の食に関わっています。" />
          <div className="mt-14 space-y-20 md:mt-20 md:space-y-28">
            {businesses.map((b, i) => (
              <article id={b.id} key={b.id} className="grid scroll-mt-28 items-center gap-8 lg:grid-cols-2 lg:gap-16">
                <ScrollReveal className={i % 2 === 1 ? "lg:order-2" : undefined}>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-mist">
                    <Image
                      src={b.image.src}
                      alt={b.image.alt}
                      fill
                      sizes="(min-width: 1024px) 45vw, 100vw"
                      className="object-cover"
                      style={b.image.position ? { objectPosition: b.image.position } : undefined}
                    />
                  </div>
                </ScrollReveal>
                <ScrollReveal delay={0.1}>
                  <p className="flex items-baseline gap-3">
                    <span className="num text-4xl font-extrabold text-brand">{b.no}</span>
                    <span className="num text-xs font-semibold tracking-[0.25em] text-brand">{b.en}</span>
                  </p>
                  <h3 className="heading-md mt-3">{b.title}</h3>
                  <p className="mt-4 leading-[1.95] text-ink/75">{b.lead}</p>
                  <ul className="mt-8 space-y-4">
                    {b.services.map((s) => (
                      <li key={s.name} className="rounded-2xl border border-line p-5 md:p-6">
                        <p className="font-bold">{s.name}</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.description}</p>
                        {s.href &&
                          (s.href.startsWith("http") ? (
                            <a
                              href={s.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline"
                            >
                              {s.linkLabel}
                              <ArrowUpRight size={15} aria-hidden="true" />
                              <span className="sr-only">（新しいタブで開きます）</span>
                            </a>
                          ) : (
                            <Link href={s.href} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline">
                              {s.linkLabel}
                              <ArrowRight size={15} aria-hidden="true" />
                            </Link>
                          ))}
                      </li>
                    ))}
                  </ul>
                </ScrollReveal>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="history" aria-labelledby="history-title" className="section scroll-mt-24 bg-mist">
        <div className="container-x max-w-4xl!">
          <SectionHeading en="HISTORY" title={<span id="history-title">沿革</span>} />
          <ol className="mt-12 border-l border-line">
            {history.map((y) => (
              <li key={y.year} className="relative pb-10 pl-8 last:pb-0 md:pl-12">
                <span aria-hidden="true" className="absolute top-1.5 -left-[5px] size-2.5 rounded-full bg-brand" />
                <p className="num text-2xl font-extrabold">{y.year}</p>
                <ul className="mt-3 space-y-2">
                  {y.events.map((e) => (
                    <li key={e.text} className="flex gap-4 text-[15px]">
                      <span className="num w-10 shrink-0 font-bold text-muted">{e.month}</span>
                      {e.text}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="company" aria-labelledby="company-title" className="section scroll-mt-24">
        <div className="container-x max-w-4xl!">
          <SectionHeading en="COMPANY" title={<span id="company-title">会社概要</span>} />
          <dl className="mt-12 border-t border-line">
            {corpProfile
              .filter((r) => r.value)
              .map((r) => (
                <div key={r.label} className="grid gap-2 border-b border-line py-6 md:grid-cols-[200px_1fr] md:gap-8 md:py-7">
                  <dt className="text-sm font-bold text-muted">{r.label}</dt>
                  <dd className="text-[15px] leading-[1.9] whitespace-pre-line">{r.value}</dd>
                </div>
              ))}
          </dl>
        </div>
      </section>

      <section aria-label="お問い合わせ" className="section pt-0!">
        <div className="container-x">
          <div className="bg-gradient-brand flex flex-col items-center gap-5 rounded-[32px] px-6 py-14 text-center text-white md:py-20">
            <p className="text-2xl font-extrabold md:text-3xl">お問い合わせ</p>
            <p className="max-w-xl text-sm leading-relaxed text-white/90">
              事業へのご相談、取材のご依頼など、お気軽にお問い合わせください。
              <br />
              インフルエンサーPRのご相談は、MIRATSUMUのフォームからも受け付けています。
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <CTAButton href="/corp/contact" variant="dark" trackLocation="corp_home">
                お問い合わせフォーム
              </CTAButton>
              <CTAButton href="/contact" variant="outline" trackLocation="corp_home_miratsumu" className="border-white! text-white!">
                インフルエンサーPRの相談
              </CTAButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
