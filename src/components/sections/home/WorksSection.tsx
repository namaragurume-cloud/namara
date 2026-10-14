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
    <section aria-label="発信者たちのPR実績" className="section overflow-hidden bg-white">
      <div className="container-x">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            en="CREATORS' WORKS"
            title={
              <>
                数字で見る、
                <br />
                発信者たちのPR実績。
              </>
            }
            lead="MIRATSUMUのネットワークに参加する発信者たちが、これまでに手がけたPR投稿の一部をご紹介します。"
          />
          {cases.length > 0 && (
            <ScrollReveal className="shrink-0">
              <CTAButton href="/works" variant="outline" trackLocation="home_works">
                実績をもっと見る
              </CTAButton>
            </ScrollReveal>
          )}
        </div>
        <ScrollReveal className="mt-14 md:mt-20">
          {cases.length > 0 ? (
            <>
              <Carousel label="発信者たちのPR実績">
                {cases.map((c) => (
                  <div key={c.slug} className="h-full rounded-[24px] border border-line">
                    <CaseStudyCard item={c} />
                  </div>
                ))}
              </Carousel>
              <p className="mt-6 text-xs leading-relaxed text-muted">
                ※成果はPR以外の要因を含む場合があります。各事例の集計期間・条件は詳細ページをご確認ください。
              </p>
            </>
          ) : (
            <WorksEmpty theme="light" />
          )}
        </ScrollReveal>
      </div>
    </section>
  );
}
