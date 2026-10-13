import { FinalCTA } from "@/components/sections/FinalCTA";
import { Flow } from "@/components/sections/Flow";
import { BrandConcept } from "@/components/sections/home/BrandConcept";
import { AboutIntro } from "@/components/sections/home/AboutIntro";
import { CreatorsSection } from "@/components/sections/home/CreatorsSection";
import { FaqSection } from "@/components/sections/home/FaqSection";
import { Hero } from "@/components/sections/home/Hero";
import { PricingOverview } from "@/components/sections/home/PricingOverview";
import { Reasons } from "@/components/sections/home/Reasons";
import { ServicesOverview } from "@/components/sections/home/ServicesOverview";
import { Stats } from "@/components/sections/home/Stats";
import { WorksSection } from "@/components/sections/home/WorksSection";

export default function HomePage() {
  return (
    <>
      <Hero />
      <BrandConcept />
      <Stats />
      <AboutIntro />
      <Reasons />
      <ServicesOverview />
      <CreatorsSection />
      <WorksSection />
      <PricingOverview />
      <Flow />
      <FaqSection />
      <FinalCTA />
    </>
  );
}
