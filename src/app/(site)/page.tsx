import { FinalCTA } from "@/components/sections/FinalCTA";
import { Flow } from "@/components/sections/Flow";
import { CreatorsSection } from "@/components/sections/home/CreatorsSection";
import { FaqSection } from "@/components/sections/home/FaqSection";
import { Hero } from "@/components/sections/home/Hero";
import { PainsSection } from "@/components/sections/home/PainsSection";
import { PricingOverview } from "@/components/sections/home/PricingOverview";
import { Reasons } from "@/components/sections/home/Reasons";
import { ServicesOverview } from "@/components/sections/home/ServicesOverview";
import { Stats } from "@/components/sections/home/Stats";
import { WorksSection } from "@/components/sections/home/WorksSection";

/**
 * トップページ。
 * ブランドストーリー・なまらグルメの紹介・これまでの活動は /about に掲載しています。
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <PainsSection />
      <ServicesOverview />
      <WorksSection />
      <CreatorsSection />
      <Reasons />
      <Stats />
      <PricingOverview />
      <Flow />
      <FaqSection />
      <FinalCTA />
    </>
  );
}
