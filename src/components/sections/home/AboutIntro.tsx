import { images } from "@/data/images";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { Photo } from "@/components/ui/Photo";
import { SectionLabel } from "@/components/ui/SectionHeading";

export function AboutIntro() {
  return (
    <section aria-labelledby="about-title" className="section overflow-hidden bg-mist">
      <div className="container-x grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
        <ScrollReveal className="relative order-2 lg:order-1">
          <Photo
            image={images.aboutMain}
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="ml-auto aspect-[4/5] w-[82%] rounded-[24px]"
          />
          <Photo
            image={images.aboutSub}
            tone="warm"
            sizes="(min-width: 1024px) 22vw, 50vw"
            className="absolute left-0 bottom-[-8%] aspect-square w-[46%] rounded-[20px] border-[6px] border-mist"
          />
        </ScrollReveal>

        <div className="order-1 lg:order-2">
          <ScrollReveal>
            <SectionLabel>OPERATED BY NAMARA GOURMET</SectionLabel>
            <h2 id="about-title" className="heading-lg mt-5">
              北海道の食を
              <br />
              発信し続けてきた、
              <br />
              なまらグルメ。
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="lead mt-8 space-y-5 text-ink/75">
            <p>
              2021年4月の運営開始以来、北海道の飲食店や食の魅力をSNSを通じて発信してきた「なまらグルメ」。
            </p>
            <p>
              SNS運営だけでなく、商品開発、店舗プロデュース、イベント企画、飲食店運営など、食に関わるさまざまな活動を展開しています。
            </p>
            <p>
              こうした経験とネットワークを活かし、北海道のグルメに特化したクリエイターキャスティングサービス「MIRATSUMU（ミラツム）」を展開します。
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2} className="mt-10">
            <CTAButton href="/about" variant="outline" trackLocation="home_about">
              MIRATSUMUについて
            </CTAButton>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
