import { getVisibleCases } from "@/data/cases";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CaseStudyCard } from "@/components/ui/CaseStudyCard";
import { Carousel } from "@/components/ui/Carousel";
import { CTAButton } from "@/components/ui/CTAButton";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WorksEmpty } from "@/components/ui/WorksEmpty";

export function WorksSection() {
  const cases = getVisibleCases();
  return (
    <section aria-label="PR実績" className="section overflow-hidden bg-ink text-white">
      <div className="container-x">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            theme="dark"
            en="WORKS"
            title={
              <>
                数字で見る、
                <br />
                MIRATSUMUのPR実績。
              </>
            }
          />
          {cases.length > 0 && (
            <ScrollReveal className="shrink-0">
              <CTAButton href="/works" variant="outline-light" trackLocation="home_works">
                PR実績を見る
              </CTAButton>
            </ScrollReveal>
          )}
        </div>
        <ScrollReveal className="mt-14 md:mt-20">
          {cases.length > 0 ? (
            <>
              <Carousel label="PR実績" theme="dark">
                {cases.map((c) => (
                  <CaseStudyCard key={c.slug} item={c} />
                ))}
              </Carousel>
              <p className="mt-6 text-xs leading-relaxed text-white/50">
                ※成果はPR以外の要因を含む場合があります。各事例の集計期間・条件は詳細ページをご確認ください。
              </p>
            </>
          ) : (
            <WorksEmpty />
          )}
        </ScrollReveal>
      </div>
    </section>
  );
}
