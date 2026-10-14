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
    <section aria-label="インフルエンサー紹介" className="section overflow-hidden bg-white">
      <div className="container-x">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            en="CREATORS"
            title={
              <>
                北海道のグルメを
                <br />
                知り尽くした、発信者たち。
              </>
            }
            lead="フォロワー10万人超の大型インフルエンサーから、地域密着型のマイクロインフルエンサーまで。約50人の発信者とのネットワークから、商品や店舗に合う発信者をご提案します。"
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
