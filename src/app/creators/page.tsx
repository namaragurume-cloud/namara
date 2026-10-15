import { getCreatorsWithFollowers } from "@/lib/creators";
import { site } from "@/data/site";
import { pageMetadata } from "@/lib/metadata";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CreatorList } from "@/components/sections/CreatorList";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { CreatorsEmpty } from "@/components/ui/CreatorsEmpty";
import { CTAButton } from "@/components/ui/CTAButton";
import { PageHero } from "@/components/ui/PageHero";

export const metadata = pageMetadata({
  title: "札幌・北海道のグルメインフルエンサー紹介",
  description:
    "札幌を中心に北海道のグルメ情報を発信するインフルエンサーをご紹介。SNS総フォロワー115万人以上のネットワークから、店舗や商品に合う発信者をご提案します。",
  path: "/creators",
});

export default async function CreatorsPage() {
  const creators = await getCreatorsWithFollowers();
  return (
    <>
      <PageHero
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
            <p className="mt-2">フォロワー10万人を超える大型インフルエンサーから、地域に根ざしたマイクロインフルエンサーまで。</p>
            <p className="mt-2">
              一人ひとりの個性と発信力を活かし、商品や店舗に込められた想いを、最適なカタチで届けるクリエイターをご提案します。
            </p>
          </>
        }
        breadcrumb={[{ label: "インフルエンサー紹介", href: "/creators" }]}
      />

      <section aria-label="発信者一覧" className="section">
        <div className="container-x">
          {creators.length > 0 ? (
            <>
              <CreatorList creators={creators} />
              <p className="mt-10 text-xs leading-relaxed text-muted">
                ※掲載しているのはネットワークの一部です。最終的な発信者のご提案は、目的やご予算、スケジュールを踏まえてMIRATSUMUが行います。
              </p>
              <div className="mt-12 flex flex-col items-center gap-4 rounded-[28px] bg-mist p-8 text-center md:p-12">
                <p className="text-lg font-bold md:text-xl">どの発信者が合うか迷ったら、MIRATSUMUにお任せください。</p>
                <p className="text-sm text-muted">目的・ご予算・ターゲットを伺い、相性の良い発信者をご提案します。</p>
                <CTAButton href="/contact" size="lg" trackLocation="creators_list" className="mt-2">
                  {site.cta}
                </CTAButton>
              </div>
            </>
          ) : (
            <ScrollReveal>
              <CreatorsEmpty location="creators_empty" />
            </ScrollReveal>
          )}
        </div>
      </section>

      <section aria-label="インフルエンサーの方へ" className="pb-24 md:pb-32">
        <div className="container-x">
          <ScrollReveal className="flex flex-col gap-6 rounded-[28px] border border-line p-8 md:flex-row md:items-center md:justify-between md:p-12">
            <div>
              <p className="num text-xs font-semibold tracking-[0.25em] text-brand">FOR CREATORS</p>
              <p className="mt-3 text-xl font-bold">北海道のグルメを発信している方へ</p>
              <p className="mt-2 text-sm text-muted">MIRATSUMUでは、グルメインフルエンサーの登録を受け付けています。</p>
            </div>
            <CTAButton href="/partner" variant="dark" trackLocation="creators_partner" className="shrink-0">
              インフルエンサー登録
            </CTAButton>
          </ScrollReveal>
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
