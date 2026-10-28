import { site } from "@/data/site";
import { getCreatorsWithFollowers } from "@/lib/creators";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { Carousel } from "@/components/ui/Carousel";
import { CreatorCard } from "@/components/ui/CreatorCard";
import { CreatorsEmpty } from "@/components/ui/CreatorsEmpty";
import { CreatorMini } from "@/components/ui/CreatorMini";
import { SectionHeading } from "@/components/ui/SectionHeading";

export async function CreatorsSection() {
  const all = await getCreatorsWithFollowers();
  const creators = all.filter((c) => c.size !== "compact");
  const network = all.filter((c) => c.size === "compact");
  return (
    <section aria-label="インフルエンサー紹介" className="section overflow-hidden bg-mist">
      <div className="container-x">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            en="CREATORS"
            title={
              <>
                <span className="inline-block">北海道のグルメを、</span>
                <br />
                <span className="inline-block">未来へ紡いでいく</span>
                <span className="inline-block">発信者たち。</span>
              </>
            }
            lead={
              <>
                <p>
                  MIRATSUMUには、札幌を中心に北海道のグルメの魅力を届ける、
                  <strong className="font-bold text-ink">SNS総フォロワー115万人以上の発信者ネットワーク</strong>
                  があります。
                </p>
                <p className="mt-2">
                  フォロワー10万人を超える大型インフルエンサーから、地域に根ざしたマイクロインフルエンサーまで。一人ひとりの個性と発信力を活かし、商品や店舗に込められた想いを、最適なカタチで届けるクリエイターをご提案します。
                </p>
              </>
            }
          />
          {creators.length > 0 && (
            <ScrollReveal className="shrink-0">
              <CTAButton href="/creators" variant="outline" trackLocation="home_creators">
                インフルエンサーを探す
              </CTAButton>
            </ScrollReveal>
          )}
        </div>

        <ScrollReveal className="mt-14 md:mt-20">
          {creators.length > 0 ? (
            <Carousel label="グルメインフルエンサー" itemClassName="w-[calc(50%-10px)] sm:w-[46%] lg:w-[31%]">
              {creators.map((c) => (
                <CreatorCard key={c.id} creator={c} />
              ))}
            </Carousel>
          ) : (
            <CreatorsEmpty location="home_creators_empty" />
          )}
        </ScrollReveal>
        <ScrollReveal>
          {network.length > 0 && (
            <div className="mt-10">
              <p className="text-sm font-bold">そのほかのネットワーク発信者</p>
              <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
                {network.map((c) => (
                  <li key={c.id}>
                    <CreatorMini creator={c} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ScrollReveal>
        {creators.length > 0 && (
          <ScrollReveal className="mt-12 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted">掲載しているのはネットワークの一部です。目的やご予算に合う発信者をご提案します。</p>
            <CTAButton href="/contact" size="lg" trackLocation="home_creators">
              {site.cta}
            </CTAButton>
          </ScrollReveal>
        )}
      </div>
    </section>
  );
}
