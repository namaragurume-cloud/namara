import Image from "next/image";
import { heroMosaic, images } from "@/data/images";
import { Check } from "lucide-react";
import { site, stats } from "@/data/site";
import { CTAButton } from "@/components/ui/CTAButton";
import { Photo } from "@/components/ui/Photo";

const keywords = ["SAPPORO", "RAMEN", "SEAFOOD", "SWEETS", "JINGISUKAN", "IZAKAYA", "CAFE", "HOKKAIDO"];

export function Hero() {
  const follower = stats.items[0];
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink text-white">
      {/* 背景：現場で撮影した活動写真を敷き詰めて暗く重ねる */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="anim-slow-zoom grid h-full w-full grid-cols-2 grid-rows-3 gap-1 md:grid-cols-3 md:grid-rows-2">
          {heroMosaic.map((img, i) => (
            <div key={img.src} className="relative overflow-hidden">
              <Image
                src={img.src!}
                alt=""
                fill
                priority={i < 2}
                sizes="(min-width: 768px) 34vw, 50vw"
                style={img.position ? { objectPosition: img.position } : undefined}
                className="object-cover"
              />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50" />
      </div>

      <div className="container-x relative flex flex-1 items-center pt-[var(--header-h)]">
        <div className="grid w-full items-end gap-12 pt-10 pb-14 md:py-16 lg:grid-cols-[1fr_auto] lg:py-24">
          <div className="max-w-3xl">
            <p
              className="anim-fade-up flex items-center gap-3 text-xs font-bold tracking-[0.2em] text-white/85 md:text-[13px]"
              style={{ animationDelay: "100ms" }}
            >
              <span aria-hidden="true" className="h-px w-8 bg-brand" />
              {site.tagline}
            </p>
            <h1
              id="hero-title"
              className="anim-fade-up heading-xl mt-6 text-[clamp(2.3rem,1rem+5.2vw,5rem)] leading-[1.2]"
              style={{ animationDelay: "200ms" }}
            >
              <span className="inline-block">北海道のグルメを、</span>
              <br />
              <span className="inline-block text-brand">未来へ紡ぐ。</span>
            </h1>
            <div className="mt-6 flex flex-col md:mt-8">
              <p
                className="anim-fade-up max-w-2xl text-[16px] leading-[1.9] font-bold text-white md:text-xl"
                style={{ animationDelay: "350ms" }}
              >
                <span className="inline-block">北海道の飲食店・食品メーカー・企業のための、</span>
                <span className="inline-block">グルメ特化型</span>
                <span className="inline-block">インフルエンサーキャスティングサービス。</span>
              </p>
              <p
                className="anim-fade-up order-last mt-6 max-w-2xl text-[14px] leading-[2] text-white/75 sm:order-none sm:mt-5 md:text-[15px]"
                style={{ animationDelay: "450ms" }}
              >
                北海道のグルメメディア「なまらグルメ」が培ってきた発信力とネットワークを活かし、店舗集客・新商品PR・認知拡大をサポート。インフルエンサーの選定から企画・投稿管理・効果報告まで、ワンストップで対応します。
              </p>
              <ul
                className="anim-fade-up mt-6 flex flex-wrap gap-2.5"
                style={{ animationDelay: "500ms" }}
                aria-label="ご相談の条件"
              >
                {["ご予算3万円〜相談可能", "無料お見積もり"].map((t) => (
                  <li
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[13px] font-bold backdrop-blur-sm"
                  >
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
                <CTAButton href="/works" size="lg" variant="outline-light" trackLocation="hero">
                  PR実績を見る
                </CTAButton>
              </div>
            </div>
          </div>

          {/* インフルエンサー撮影風景 */}
          <div
            className="anim-fade-up relative hidden w-[300px] lg:block xl:w-[340px]"
            style={{ animationDelay: "800ms" }}
          >
            <Photo
              image={images.heroShooting}
              tone="warm"
              sizes="340px"
              className="aspect-[3/4] rounded-[28px] shadow-2xl ring-1 ring-white/15"
            />
            <div className="absolute -bottom-6 -left-10 rounded-2xl bg-white px-5 py-4 text-ink shadow-xl">
              <p className="num text-[10px] font-semibold tracking-[0.2em] text-brand">SNS TOTAL</p>
              <p className="mt-1 text-sm font-bold">
                総フォロワー <span className="num text-xl">{follower.value}</span>
                {follower.suffix}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* キーワードのマーキー */}
      <div aria-hidden="true" className="relative border-t border-white/10 py-5">
        <div className="flex w-max anim-marquee">
          {[0, 1].map((n) => (
            <div key={n} className="flex shrink-0 items-center">
              {keywords.map((k) => (
                <span key={k} className="num flex items-center px-6 text-sm font-semibold tracking-[0.3em] text-white/40">
                  {k}
                  <span className="ml-12 size-1 rounded-full bg-brand" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div aria-hidden="true" className="absolute right-6 bottom-24 hidden flex-col items-center gap-3 md:flex lg:hidden">
        <span className="num text-[10px] font-semibold tracking-[0.3em] text-white/60 [writing-mode:vertical-rl]">SCROLL</span>
        <span className="relative h-14 w-px overflow-hidden bg-white/20">
          <span className="anim-scroll-line absolute inset-0 bg-white" />
        </span>
      </div>
    </section>
  );
}
