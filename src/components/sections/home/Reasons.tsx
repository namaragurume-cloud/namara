import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { reasons } from "@/data/reasons";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { Photo } from "@/components/ui/Photo";
import { SectionHeading } from "@/components/ui/SectionHeading";

/** トップページ：MIRATSUMUが選ばれる理由（3つの強み） */
export function Reasons() {
  return (
    <section aria-labelledby="reasons-title" className="section bg-white">
      <div className="container-x">
        <SectionHeading
          en="WHY MIRATSUMU"
          align="center"
          title={
            <span id="reasons-title">
              <span className="inline-block">なぜ、MIRATSUMUが</span>
              <span className="inline-block">選ばれるのか。</span>
            </span>
          }
          lead="北海道の食材・店舗・発信者をつなぐ。グルメメディアを運営し、飲食店の現場も知るMIRATSUMUだからこその、3つの強みがあります。"
        />

        <ol className="mt-12 grid gap-6 md:mt-16 lg:grid-cols-3 lg:gap-8">
          {reasons.map((r, i) => (
            <ScrollReveal
              as="li"
              key={r.no}
              delay={i * 0.1}
              className="group flex flex-col overflow-hidden rounded-[24px] border border-line bg-white"
            >
              <Photo
                image={r.image}
                sizes="(min-width: 1024px) 30vw, 100vw"
                className="aspect-[16/10]"
                imgClassName="transition-transform duration-700 ease-out-expo group-hover:scale-105"
              />
              <div className="flex flex-1 flex-col p-6 md:p-8">
                <p className="num flex items-baseline gap-3 text-brand">
                  <span className="text-gradient-brand text-4xl font-extrabold">{r.no}</span>
                  <span className="text-[11px] font-semibold tracking-[0.25em]">{r.label}</span>
                </p>
                <h3 className="heading-md mt-3">{r.title}</h3>
                <p className="mt-3 text-[15px] leading-[1.95] text-muted">{r.body}</p>
                {r.link && (
                  <Link
                    href={r.link.href}
                    className="group/link mt-auto inline-flex items-center gap-2 pt-6 text-sm font-bold transition-colors hover:text-brand"
                  >
                    {r.link.label}
                    <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover/link:translate-x-1" />
                  </Link>
                )}
              </div>
            </ScrollReveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
