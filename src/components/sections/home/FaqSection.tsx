import { faq } from "@/data/faq";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { FAQAccordion } from "@/components/ui/FAQAccordion";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function FaqSection() {
  const items = faq.filter((f) => f.featured).slice(0, 5);
  return (
    <section aria-label="よくある質問" className="section bg-mist">
      <div className="container-x grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-20">
        <div>
          <SectionHeading en="FAQ" title="よくある質問" />
          <ScrollReveal className="mt-8">
            <CTAButton href="/faq" variant="outline" trackLocation="home_faq">
              すべての質問を見る
            </CTAButton>
          </ScrollReveal>
        </div>
        <ScrollReveal>
          <FAQAccordion items={items} />
        </ScrollReveal>
      </div>
    </section>
  );
}
