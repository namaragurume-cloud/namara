import { getVisibleCases } from "@/data/cases";
import { site } from "@/data/site";
import { pageMetadata } from "@/lib/metadata";
import { CTAButton } from "@/components/ui/CTAButton";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { CaseStudyCard } from "@/components/ui/CaseStudyCard";
import { PageHero } from "@/components/ui/PageHero";
import { WorksEmpty } from "@/components/ui/WorksEmpty";

export const metadata = pageMetadata({
  title: "発信者の実績｜北海道グルメのPR事例",
  description:
    "MIRATSUMUのネットワークに参加する北海道・札幌のグルメインフルエンサーが手がけた、飲食店や食品のPR投稿の実績をご紹介します。",
  path: "/works",
});

export default function WorksPage() {
  const cases = getVisibleCases();
  return (
    <>
      <PageHero
        en="CREATORS' WORKS"
        title={
          <>
            数字で見る、
            <br className="hidden md:block" />
            発信者たちのPR実績。
          </>
        }
        lead="MIRATSUMUのネットワークに参加する発信者たちが、これまでに手がけたPR投稿の一部をご紹介します。掲載の許可をいただいた事例のみ公開しています。"
        breadcrumb={[{ label: "発信者の実績", href: "/works" }]}
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
                ※再生回数はPR投稿が視聴された回数で、来店数や売上を示すものではありません。各事例の集計条件は詳細ページをご確認ください。
              </p>
              <div className="mt-12 flex flex-col items-center gap-4 rounded-[28px] bg-mist p-8 text-center md:p-12">
                <p className="text-lg font-bold md:text-xl">同じようなPRをご検討中の方へ</p>
                <p className="text-sm text-muted">商品やお店の魅力に合う発信者と、投稿の企画をご提案します。</p>
                <CTAButton href="/contact" size="lg" trackLocation="works_list" className="mt-2">
                  {site.cta}
                </CTAButton>
              </div>
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
