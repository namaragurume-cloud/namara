import Image from "next/image";
import { Check, Sparkles } from "lucide-react";
import { site } from "@/data/site";
import { CTAButton } from "@/components/ui/CTAButton";

/** 下部で流れる活動写真（現場で撮影した写真） */
const strip = [
  { src: "/images/activities/akkeshi-oyster.jpg", alt: "厚岸町の牡蠣漁" },
  { src: "/images/works/butter-cafe.jpg", alt: "バター専門カフェのPR投稿" },
  { src: "/images/activities/nanporo-corn.jpg", alt: "南幌町のとうもろこし畑" },
  { src: "/images/activities/autumnfest-2024.jpg", alt: "さっぽろオータムフェスト2024の出店" },
  { src: "/images/works/jingisukan.jpg", alt: "ジンギスカン店のPR投稿" },
  { src: "/images/activities/tokachi-farm.jpg", alt: "十勝の生産者さんの農場" },
  { src: "/images/works/wagashi.jpg", alt: "和菓子店のPR投稿" },
  { src: "/images/activities/tokachi-potato.jpg", alt: "十勝のじゃがいもの貯蔵庫" },
  { src: "/images/activities/australia-field.jpg", alt: "オーストラリアの牧場視察" },
];

/** 「紡ぐ」を表す糸の曲線 */
function Threads() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 720"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
      fill="none"
    >
      <path className="thread" d="M-40 520 C 280 380, 520 640, 820 460 S 1260 260, 1500 360" stroke="var(--brand)" strokeOpacity="0.35" strokeWidth="1.6" />
      <path className="thread" style={{ animationDelay: "0.3s, 3.5s" }} d="M-40 580 C 320 460, 560 700, 860 520 S 1280 340, 1500 430" stroke="var(--accent)" strokeOpacity="0.3" strokeWidth="1.2" />
      <path className="thread" style={{ animationDelay: "0.6s, 3.8s" }} d="M-40 460 C 260 320, 540 560, 800 400 S 1240 200, 1500 290" stroke="var(--ink)" strokeOpacity="0.12" strokeWidth="1" />
    </svg>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex flex-col overflow-hidden bg-cream">
      {/* 背景：温かいグラデーションの光・グリッド・糸 */}
      <div aria-hidden="true" className="bg-glow absolute inset-0 -z-20" />
      <div aria-hidden="true" className="bg-grid absolute inset-0 -z-20" />
      <Threads />

      <div className="container-x relative pt-[calc(var(--header-h)+40px)] pb-12 md:pt-[calc(var(--header-h)+80px)] md:pb-16">
        <div className="max-w-4xl">
          <p
            className="anim-fade-up glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold tracking-[0.12em] text-ink/80 md:text-[13px]"
            style={{ animationDelay: "100ms" }}
          >
            <Sparkles size={14} aria-hidden="true" className="text-brand" />
            {site.tagline}
          </p>
          <h1
            id="hero-title"
            className="anim-fade-up heading-xl mt-6 text-[clamp(2.3rem,1rem+5.2vw,5.25rem)] leading-[1.18] text-ink"
            style={{ animationDelay: "200ms" }}
          >
            <span className="inline-block">北海道のグルメを、</span>
            <br />
            <span className="text-gradient-brand inline-block pb-1">未来へ紡ぐ。</span>
          </h1>
          <div className="mt-6 flex flex-col md:mt-8">
            <p
              className="anim-fade-up max-w-2xl text-[16px] leading-[1.9] font-bold text-ink md:text-xl"
              style={{ animationDelay: "350ms" }}
            >
              <span className="inline-block">北海道の飲食店・食品メーカー・企業のための、</span>
              <span className="inline-block">グルメ特化型</span>
              <span className="inline-block">インフルエンサーキャスティングサービス。</span>
            </p>
            <p
              className="anim-fade-up order-last mt-6 max-w-2xl text-[14px] leading-[2] text-ink/65 sm:order-none sm:mt-5 md:text-[15px]"
              style={{ animationDelay: "450ms" }}
            >
              北海道のグルメメディア「なまらグルメ」が培ってきた発信力とネットワークを活かし、店舗集客・新商品PR・認知拡大をサポート。インフルエンサーの選定から企画・投稿管理・効果報告まで、ワンストップで対応します。
            </p>
            <ul className="anim-fade-up mt-6 flex flex-wrap gap-2.5" style={{ animationDelay: "500ms" }} aria-label="ご相談の条件">
              {["ご予算3万円〜相談可能", "無料お見積もり"].map((t) => (
                <li key={t} className="glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold text-ink">
                  <Check size={15} aria-hidden="true" className="text-brand" />
                  {t}
                </li>
              ))}
            </ul>
            <div
              className="anim-fade-up mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
              style={{ animationDelay: "600ms" }}
            >
              <CTAButton href="/contact" size="lg" trackLocation="hero">
                {site.cta}
              </CTAButton>
              <CTAButton href="/works" size="lg" variant="outline" trackLocation="hero" className="bg-white/60 backdrop-blur">
                PR実績を見る
              </CTAButton>
            </div>
          </div>
        </div>
      </div>

      {/* 活動写真のストリップ */}
      <div aria-hidden="true" className="anim-fade-up relative pb-12 md:pb-16" style={{ animationDelay: "700ms" }}>
        <div className="flex w-max anim-marquee gap-4 [animation-duration:60s]">
          {[0, 1].map((n) => (
            <div key={n} className="flex shrink-0 gap-4">
              {strip.map((img, i) => (
                <div
                  key={img.src}
                  className={`relative h-40 w-32 shrink-0 overflow-hidden rounded-[22px] shadow-[0_20px_40px_-24px_rgba(120,60,30,0.5)] ring-1 ring-white md:h-56 md:w-44 ${i % 2 ? "translate-y-4" : ""}`}
                >
                  <Image src={img.src} alt="" fill sizes="176px" priority={n === 0 && i < 4} className="object-cover" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
