import { history } from "@/data/history";
import { images } from "@/data/images";
import { stats } from "@/data/site";
import { pageMetadata } from "@/lib/metadata";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { PageHero } from "@/components/ui/PageHero";
import { Photo } from "@/components/ui/Photo";
import { SectionHeading, SectionLabel } from "@/components/ui/SectionHeading";
import { Timeline } from "@/components/ui/Timeline";

export const metadata = pageMetadata({
  title: "なまらグルメについて",
  description:
    "2021年4月から北海道のグルメ情報を発信するメディア「なまらグルメ」。SNS発信、コラボ商品開発、店舗プロデュース、イベント企画、飲食店運営まで、北海道の食に関わる活動をご紹介します。",
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
  "そんな思いから、グルメに特化したキャスティング事業を本格的に展開します。",
  "北海道の食を盛り上げたいという気持ちは、立ち上げ当初から今も変わりません。",
  "北海道の食に関するSNS発信を相談するなら、まず「なまらグルメ」へ。",
  "そう思っていただける存在を目指して、これからも挑戦を続けていきます。",
];

export default function AboutPage() {
  const follower = stats.items[0];
  return (
    <>
      <PageHero
        en="ABOUT"
        title={
          <>
            北海道の食の魅力を、
            <br className="hidden md:block" />
            もっと多くの人へ。
          </>
        }
        breadcrumb={[{ label: "なまらグルメについて", href: "/about" }]}
      />

      <section aria-label="なまらグルメとは" className="section">
        <div className="container-x grid items-center gap-14 lg:grid-cols-2 lg:gap-24">
          <ScrollReveal>
            <Photo
              image={images.aboutMain}
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="aspect-[4/3] rounded-[28px]"
            />
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="space-y-5 text-[15px] leading-[2.1] text-ink/80 md:text-base">
            <p>北海道のグルメ情報を発信するメディア「なまらグルメ」。</p>
            <p>2021年4月の運営開始以来、北海道の飲食店や食の魅力をSNSを通じて発信してきました。</p>
            <p className="py-2">
              <span className="block text-sm font-bold text-muted">現在のInstagramフォロワー</span>
              <span className="mt-1 flex items-baseline gap-1 font-extrabold text-ink">
                <span className="num text-6xl text-brand">{follower.value}</span>
                <span className="text-2xl">{follower.suffix}</span>
              </span>
            </p>
            <p>
              飲食店のPR支援、コラボ商品開発、店舗プロデュース、イベント企画など、SNSの枠を超えて北海道の食に関わるさまざまな活動を展開しています。
            </p>
            <p>
              これまで培ってきた経験とネットワークを活かし、北海道のグルメに特化したインフルエンサーキャスティング事業を本格展開します。
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section aria-labelledby="story-title" className="section bg-ink text-white">
        <div className="container-x grid gap-14 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-20">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+48px)] lg:self-start">
            <ScrollReveal>
              <SectionLabel theme="dark">STORY</SectionLabel>
              <h2 id="story-title" className="heading-lg mt-5 text-white">
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
            <p className="pt-6 text-right font-bold text-white">なまらグルメ 運営者　島田</p>
          </ScrollReveal>
        </div>
      </section>

      <section aria-label="活動年表" className="section bg-mist">
        <div className="container-x">
          <SectionHeading en="HISTORY" title="活動年表" />
          <div className="mt-14 md:mt-20">
            <Timeline items={history} />
          </div>
        </div>
      </section>

      <section aria-labelledby="vision-title" className="section">
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
