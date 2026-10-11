import { getVisibleCreators } from "@/data/creators";
import { pageMetadata } from "@/lib/metadata";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CreatorList } from "@/components/sections/CreatorList";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { CreatorsEmpty } from "@/components/ui/CreatorsEmpty";
import { CTAButton } from "@/components/ui/CTAButton";
import { PageHero } from "@/components/ui/PageHero";

export const metadata = pageMetadata({
  title: "インフルエンサー紹介",
  description:
    "札幌を中心に北海道のグルメ情報を発信するインフルエンサーとのネットワーク。大型インフルエンサーから地域密着型のマイクロインフルエンサーまで、商品や店舗に合う発信者をご提案します。",
  path: "/creators",
});

export default function CreatorsPage() {
  const creators = getVisibleCreators();
  return (
    <>
      <PageHero
        en="CREATORS"
        title={
          <>
            北海道のグルメを
            <br className="hidden md:block" />
            知り尽くした、発信者たち。
          </>
        }
        lead={
          <>
            <p>
              なまらグルメでは、札幌を中心に北海道のグルメ情報を発信する約50人の発信者とのネットワークがあります。
            </p>
            <p className="mt-2">
              フォロワー10万人超の大型インフルエンサーから、地域密着型のマイクロインフルエンサーまで。商品や店舗の魅力に合う発信者をご提案します。
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
                ※掲載しているのはネットワークの一部です。最終的な発信者のご提案は、目的やご予算、スケジュールを踏まえてなまらグルメが行います。
              </p>
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
              <p className="mt-2 text-sm text-muted">なまらグルメでは、グルメインフルエンサーの登録を受け付けています。</p>
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
