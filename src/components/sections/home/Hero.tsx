import Image from "next/image";
import { heroMosaic, images } from "@/data/images";
import { stats } from "@/data/site";
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
        <div className="grid w-full items-end gap-12 py-16 lg:grid-cols-[1fr_auto] lg:py-24">
          <div className="max-w-3xl">
            <p
              className="anim-fade-up num flex items-center gap-3 text-[11px] font-semibold tracking-[0.3em] text-white/80 md:text-xs"
              style={{ animationDelay: "100ms" }}
            >
              <span aria-hidden="true" className="h-px w-8 bg-brand" />
              HOKKAIDO GOURMET INFLUENCER CASTING
            </p>
            <h1
              id="hero-title"
              className="anim-fade-up heading-xl mt-7 text-[clamp(2.6rem,1.2rem+6vw,6rem)] leading-[1.18]"
              style={{ animationDelay: "250ms" }}
            >
              北海道の食を
              <br />
              <span className="text-brand">未来へ紡ぐ</span>
            </h1>
            <p
              className="anim-fade-up mt-8 max-w-xl text-[15px] leading-[2.1] text-white/85 md:text-base"
              style={{ animationDelay: "450ms" }}
            >
              北海道のグルメに特化したインフルエンサーキャスティング。
              <br className="hidden md:block" />
              グルメメディア「なまらグルメ」が培ってきた発信力とネットワークを活かし、目的やご予算に合わせた最適なSNSプロモーションをご提案します。
            </p>
            <div
              className="anim-fade-up mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
              style={{ animationDelay: "600ms" }}
            >
              <CTAButton href="/contact" size="lg" trackLocation="hero">
                無料相談・お見積もり
              </CTAButton>
              <CTAButton href="/service" size="lg" variant="outline-light" trackLocation="hero">
                サービスを見る
              </CTAButton>
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
              <p className="num text-[10px] font-semibold tracking-[0.2em] text-brand">INSTAGRAM</p>
              <p className="mt-1 text-sm font-bold">
                フォロワー <span className="num text-xl">{follower.value}</span>
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
