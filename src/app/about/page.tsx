import Image from "next/image";
import { brand } from "@/data/brand";
import { activities } from "@/data/activities";
import { history } from "@/data/history";
import { images } from "@/data/images";
import { getMediaFollowers } from "@/lib/creators";
import { showFollowerCounts } from "@/data/site";
import { pageMetadata } from "@/lib/metadata";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { ActivityList } from "@/components/sections/ActivityList";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { PageHero } from "@/components/ui/PageHero";
import { Photo } from "@/components/ui/Photo";
import { SectionHeading, SectionLabel } from "@/components/ui/SectionHeading";
import { LogoElements } from "@/components/ui/LogoElements";
import { Timeline } from "@/components/ui/Timeline";

export const metadata = pageMetadata({
  title: "MIRATSUMUについて",
  description:
    "MIRATSUMU（ミラツム）は「未来」と「紡ぐ」を掛け合わせた、北海道発のクリエイターキャスティングサービス。ブランドに込めた想いと、運営メディア「なまらグルメ」の歩みをご紹介します。",
  path: "/about",
});

const story = [
  "私は北海道札幌市で生まれ育ち、大学進学を機に東京へ上京しました。",
  "北海道を離れたことで、食べ物のおいしさ、豊かな自然、そして人の温かさなど、当たり前だと思っていた北海道の魅力に改めて気づかされました。",
  "「大学卒業後は、大好きな北海道で仕事がしたい。」",
  "そんな思いを抱いていた中、新型コロナウイルスの感染拡大によって、多くの飲食店が厳しい状況に置かれました。",
  "もともと食べることが好きだった私は、北海道の飲食店の力になりたい、食の魅力をもっと多くの人に伝えたいと考え、2021年4月に「なまらグルメ」を立ち上げました。",
  "それから、SNSでの情報発信だけでなく、商品開発やイベント、飲食店のプロデュース・運営など、さまざまな形で北海道の食に関わってきました。",
  "活動を続ける中で、多くの飲食店や企業、そしてグルメを発信するインフルエンサーの皆さんとのつながりが生まれました。",
  "このつながりを活かして、企業や飲食店の魅力を最適な発信者とともに届けたい。そして、発信者にとっても新しい活躍の機会を生み出したい。",
  "そんな思いから、グルメに特化したクリエイターキャスティングサービス「MIRATSUMU（ミラツム）」を立ち上げました。",
  "北海道の食を盛り上げたいという気持ちは、立ち上げ当初から今も変わりません。",
  "北海道の食に関するSNS発信を相談するなら、まず「MIRATSUMU」へ。",
  "そう思っていただける存在を目指して、これからも挑戦を続けていきます。",
];

export default async function AboutPage() {
  const follower = showFollowerCounts ? await getMediaFollowers() : null;
  return (
    <>
      <PageHero
        en="ABOUT"
        title={
          <>
            北の想いを、
            <br className="hidden md:block" />
            未来へ紡ぐ。
          </>
        }
        lead={`${brand.name}（${brand.kana}）— ${brand.meaning}`}
        breadcrumb={[{ label: "MIRATSUMUについて", href: "/about" }]}
      />

      <section aria-labelledby="story-brand-title" className="section">
        <div className="container-x max-w-3xl!">
          <ScrollReveal className="text-center">
            <SectionLabel>BRAND STORY</SectionLabel>
            <h2 id="story-brand-title" className="sr-only">
              ブランドストーリー
            </h2>
          </ScrollReveal>
          <div className="mt-12 space-y-10 text-center text-[15px] leading-[2.2] text-ink/80 md:text-[17px]">
            {brand.story.map((block) => (
              <ScrollReveal key={block.lines[0]}>
                {block.emphasis ? (
                  <div className="mx-auto max-w-2xl rounded-[24px] bg-ink px-6 py-10 text-white md:px-12">
                    {block.lines.map((l) => (
                      <p key={l} className="text-lg leading-[2] font-bold md:text-2xl">
                        {l}
                      </p>
                    ))}
                  </div>
                ) : (
                  block.lines.map((l) => <p key={l}>{l}</p>)
                )}
              </ScrollReveal>
            ))}
            <ScrollReveal className="pt-6">
              <p className="num text-sm font-semibold tracking-[0.3em] text-muted">
                {brand.name} — {brand.kana}
              </p>
              <p className="mt-3 text-[clamp(1.75rem,1.2rem+2.4vw,3rem)] leading-snug font-extrabold text-ink">
                {brand.slogan.split("、")[0]}、<span className="text-brand">{brand.slogan.split("、")[1]}</span>
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section aria-labelledby="logo-title" className="section bg-mist">
        <div className="container-x grid items-center gap-14 lg:grid-cols-2 lg:gap-24">
          <ScrollReveal className="rounded-[28px] bg-white p-10 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.2)] md:p-16">
            <Image
              src="/images/brand/miratsumu-logo.png"
              alt="MIRATSUMU（ミラツム）のロゴ"
              width={900}
              height={671}
              priority
              sizes="(min-width: 1024px) 40vw, 90vw"
              className="h-auto w-full"
            />
          </ScrollReveal>
          <div>
            <ScrollReveal>
              <SectionLabel>LOGO</SectionLabel>
              <h2 id="logo-title" className="heading-lg mt-5">
                想いを結び、
                <br />
                価値を未来へ紡ぐ。
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1} className="mt-8 space-y-4 text-[15px] leading-[2.1] text-ink/80 md:text-base">
              <p>{brand.nameOrigin}</p>
              <p>{brand.logo.intro}</p>
            </ScrollReveal>
            <ScrollReveal delay={0.15} className="mt-8">
              <LogoElements />
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <p className="mt-8 text-[15px] leading-[2.1] font-bold">{brand.logo.closing}</p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section aria-labelledby="media-title" className="section">
        <div className="container-x grid items-center gap-14 lg:grid-cols-2 lg:gap-24">
          <ScrollReveal>
            <Photo
              image={images.aboutMedia}
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="aspect-[4/3] rounded-[28px]"
            />
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="space-y-5 text-[15px] leading-[2.1] text-ink/80 md:text-base">
            <SectionLabel>OPERATED BY</SectionLabel>
            <h2 id="media-title" className="heading-lg">
              運営メディア
              <br />
              「なまらグルメ」
            </h2>
            <p>MIRATSUMUを運営するのは、北海道のグルメ情報を発信するメディア「なまらグルメ」です。</p>
            <p>2021年4月の運営開始以来、北海道の飲食店や食の魅力をSNSを通じて発信してきました。</p>
            {follower && (
            <p className="py-2">
              <span className="block text-sm font-bold text-muted">現在のInstagramフォロワー</span>
              <span className="mt-1 flex items-baseline gap-1 font-extrabold text-ink">
                <span className="num text-6xl text-brand">{follower.value}</span>
                <span className="text-2xl">{follower.suffix}</span>
              </span>
            </p>
            )}
            <p>
              飲食店のPR支援、コラボ商品開発、店舗プロデュース、イベント企画など、SNSの枠を超えて北海道の食に関わるさまざまな活動を展開しています。
            </p>
            <p>
              これまで培ってきた経験とネットワークを活かし、北海道のグルメに特化したクリエイターキャスティングサービス「MIRATSUMU」を本格展開します。
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section id="activities" aria-labelledby="activities-title" className="section scroll-mt-20 bg-mist">
        <div className="container-x">
          <div className="max-w-3xl">
            <ScrollReveal>
              <SectionLabel>ACTIVITIES</SectionLabel>
              <h2 id="activities-title" className="heading-lg mt-5">
                現場に足を運び、
                <br />
                つくり手の想いを届ける。
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1} className="lead mt-8 space-y-4">
              <p>
                おいしさの裏側には、それを育て、守り、届ける人たちの物語があります。なまらグルメは、北海道各地の生産者さんや飲食店のもとへ実際に足を運び、現場で見て、聞いて、感じたことをSNSで発信してきました。
              </p>
              <p>写真と言葉だけでは伝えきれない想いを、現場から。これまでの取り組みの一部をご紹介します。</p>
            </ScrollReveal>
          </div>
          <div className="mt-16 md:mt-24">
            <ActivityList items={activities} />
          </div>
          <ScrollReveal className="mt-20 rounded-[28px] bg-ink p-8 text-white md:mt-28 md:p-14">
            <p className="num text-xs font-semibold tracking-[0.3em] text-white/50">FROM NOW ON</p>
            <p className="mt-4 text-xl leading-relaxed font-bold md:text-2xl">この取り組みに、これからもっと力を入れていきます。</p>
            <p className="mt-5 max-w-3xl text-[15px] leading-[2.1] text-white/75">
              MIRATSUMUでは、生産者さんや飲食店の現場に足を運ぶ取材・発信をさらに強化していきます。現場で受け取った想いを、プロのクリエイターとともに、より多くの人へ、そして次の世代へ。北海道の食の価値を、新しいカタチで未来へ紡いでいきます。
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section aria-labelledby="story-title" className="section bg-ink text-white">
        <div className="container-x grid gap-14 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-20">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+48px)] lg:self-start">
            <ScrollReveal>
              <SectionLabel theme="dark">STORY</SectionLabel>
              <h2 id="story-title" className="heading-lg mt-5 text-[clamp(1.5rem,1.1rem+1.4vw,2.25rem)] text-white">
                北海道の食の魅力を、
                <br />
                発信の力で広げたい。
              </h2>
              <Photo
                image={images.founder}
                tone="warm"
                sizes="(min-width: 1024px) 30vw, 100vw"
                className="mt-10 aspect-[4/5] max-w-sm rounded-[24px]"
              />
            </ScrollReveal>
          </div>
          <ScrollReveal className="space-y-6 text-[15px] leading-[2.2] text-white/80 md:text-base">
            {story.map((p) => (
              <p key={p} className={p.startsWith("「") ? "text-lg font-bold text-white md:text-xl" : undefined}>
                {p}
              </p>
            ))}
            <p className="pt-6 text-right font-bold text-white">MIRATSUMU／なまらグルメ 運営者　島田</p>
          </ScrollReveal>
        </div>
      </section>

      <section aria-label="活動年表" className="section">
        <div className="container-x">
          <SectionHeading en="HISTORY" title="活動年表" lead="運営メディア「なまらグルメ」のこれまでの歩みです。" />
          <div className="mt-14 md:mt-20">
            <Timeline items={history} />
          </div>
        </div>
      </section>

      <section aria-labelledby="vision-title" className="section bg-mist">
        <div className="container-x max-w-4xl! text-center">
          <ScrollReveal className="flex flex-col items-center">
            <SectionLabel>VISION</SectionLabel>
            <h2 id="vision-title" className="heading-lg mt-6">
              北海道の食と発信者をつなぎ、
              <br />
              新しい価値を生み出す。
            </h2>
            <div className="lead mt-10 space-y-5 text-ink/75">
              <p>私たちは、北海道のグルメに関するSNSマーケティングを気軽に相談できるサービスを目指しています。</p>
              <p>
                企業や飲食店には、目的や予算に合った発信者との出会いを。
                <br />
                インフルエンサーには、自身の発信力を活かせる新たな活躍の機会を。
              </p>
              <p>双方にとって価値のある関係を生み出し、北海道の食の魅力をより多くの人へ届けていきます。</p>
              <p>将来的には北海道最大級のグルメ特化型SNSキャスティングサービスを目指します。</p>
            </div>
          </ScrollReveal>
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
