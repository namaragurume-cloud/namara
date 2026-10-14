import { activities } from "@/data/activities";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { ActivityCard } from "@/components/ui/ActivityCard";
import { Carousel } from "@/components/ui/Carousel";
import { CTAButton } from "@/components/ui/CTAButton";
import { SectionHeading } from "@/components/ui/SectionHeading";

/** トップページ：これまでの活動 */
export function ActivitiesSection() {
  const items = activities.filter((a) => a.featured);
  return (
    <section aria-label="これまでの活動" className="section overflow-hidden bg-ink text-white">
      <div className="container-x">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            theme="dark"
            en="ACTIVITIES"
            title={
              <>
                現場に足を運び、
                <br />
                つくり手の想いを届ける。
              </>
            }
            lead="海へ、畑へ、牧場へ、そして飲食店へ。なまらグルメは北海道各地の生産者さんや飲食店のもとへ実際に足を運び、現場で見て、聞いて、感じたことをSNSで発信してきました。"
          />
          <ScrollReveal className="shrink-0">
            <CTAButton href="/about#activities" variant="outline-light" trackLocation="home_activities">
              活動をもっと見る
            </CTAButton>
          </ScrollReveal>
        </div>

        <ScrollReveal className="mt-14 md:mt-20">
          <Carousel label="これまでの活動" theme="dark" itemClassName="w-[78%] sm:w-[46%] lg:w-[31%]">
            {items.map((a) => (
              <ActivityCard key={a.id} activity={a} />
            ))}
          </Carousel>
        </ScrollReveal>

        <ScrollReveal className="mt-14 rounded-[28px] border border-white/10 bg-white/[0.04] p-8 md:mt-20 md:p-12">
          <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center md:gap-12">
            <p className="num text-xs font-semibold tracking-[0.3em] text-brand">FROM NOW ON</p>
            <p className="text-[15px] leading-[2.1] text-white/75 md:text-base">
              <strong className="text-lg font-bold text-white md:text-xl">この取り組みに、これからもっと力を入れていきます。</strong>
              <br />
              MIRATSUMUでは、生産者さんや飲食店の現場に足を運ぶ取材・発信をさらに強化。現場で受け取った想いを、プロのクリエイターとともに、より多くの人へ、そして未来へ紡いでいきます。
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
