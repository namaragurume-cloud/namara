import { getCreatorsWithFollowers } from "@/lib/creators";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { Carousel } from "@/components/ui/Carousel";
import { CreatorCard } from "@/components/ui/CreatorCard";
import { CreatorsEmpty } from "@/components/ui/CreatorsEmpty";
import { SectionHeading } from "@/components/ui/SectionHeading";

export async function CreatorsSection() {
  const creators = await getCreatorsWithFollowers();
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
            <Carousel label="グルメインフルエンサー">
              {creators.map((c) => (
                <CreatorCard key={c.id} creator={c} />
              ))}
            </Carousel>
          ) : (
            <CreatorsEmpty location="home_creators_empty" />
          )}
        </ScrollReveal>
      </div>
    </section>
  );
}
