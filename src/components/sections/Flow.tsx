import { flow, flowNote } from "@/data/flow";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function Flow({ background = "white" }: { background?: "white" | "mist" }) {
  return (
    <section aria-label="ご利用の流れ" className={background === "mist" ? "section bg-mist" : "section bg-white"}>
      <div className="container-x">
        <SectionHeading
          en="FLOW"
          title="ご利用の流れ"
          lead="お問い合わせから効果レポートまで、担当者が一貫してサポートします。"
        />

        <ol className="relative mt-14 grid gap-4 md:mt-20 md:grid-cols-2 lg:grid-cols-6 lg:gap-0">
          <span
            aria-hidden="true"
            className="absolute top-[27px] right-[8%] left-[8%] hidden h-px bg-line lg:block"
          />
          {flow.map((step, i) => (
            <ScrollReveal
              as="li"
              key={step.no}
              delay={i * 0.08}
              className="relative flex gap-5 rounded-2xl border border-line bg-white p-6 lg:flex-col lg:items-center lg:gap-0 lg:border-0 lg:bg-transparent lg:p-0 lg:px-3 lg:text-center"
            >
              <span className="num relative z-10 grid size-14 shrink-0 place-items-center rounded-full bg-ink text-base font-bold text-white ring-8 ring-white">
                {step.no}
              </span>
              <div>
                <h3 className="text-base font-bold leading-relaxed lg:mt-6">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-[1.9] text-muted">{step.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </ol>
        <p className="mt-10 text-xs text-muted">※{flowNote}</p>
      </div>
    </section>
  );
}
