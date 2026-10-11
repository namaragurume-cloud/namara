import { getVisibleCases } from "@/data/cases";
import { pageMetadata } from "@/lib/metadata";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { CaseStudyCard } from "@/components/ui/CaseStudyCard";
import { PageHero } from "@/components/ui/PageHero";
import { WorksEmpty } from "@/components/ui/WorksEmpty";

export const metadata = pageMetadata({
  title: "PR実績",
  description: "なまらグルメが手がけた北海道のグルメインフルエンサーPRの事例をご紹介します。",
  path: "/works",
});

export default function WorksPage() {
  const cases = getVisibleCases();
  return (
    <>
      <PageHero
        en="WORKS"
        title={
          <>
            数字で見る、
            <br className="hidden md:block" />
            なまらグルメのPR実績。
          </>
        }
        lead="これまでに実施したグルメPRの事例をご紹介します。企業名は匿名で掲載しています。"
        breadcrumb={[{ label: "PR実績", href: "/works" }]}
      />
      <section aria-label="事例一覧" className="section">
        <div className="container-x">
          {cases.length > 0 ? (
            <>
              <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {cases.map((c, i) => (
                  <ScrollReveal as="li" key={c.slug} delay={(i % 3) * 0.08}>
                    <div className="h-full rounded-[24px] border border-line">
                      <CaseStudyCard item={c} />
                    </div>
                  </ScrollReveal>
                ))}
              </ul>
              <p className="mt-10 text-xs leading-relaxed text-muted">
                ※成果はPR以外の要因を含む場合があります。各事例の集計期間・条件は詳細ページをご確認ください。
              </p>
            </>
          ) : (
            <ScrollReveal>
              <WorksEmpty theme="light" />
            </ScrollReveal>
          )}
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
