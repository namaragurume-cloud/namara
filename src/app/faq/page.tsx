import { faq } from "@/data/faq";
import { pageMetadata } from "@/lib/metadata";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { FAQAccordion } from "@/components/ui/FAQAccordion";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/ui/PageHero";

export const metadata = pageMetadata({
  title: "よくある質問",
  description:
    "MIRATSUMUのインフルエンサーPRに関するよくある質問。予算3万円での依頼、インフルエンサーの指定、投稿までの期間、道外企業や飲食店以外の商品PR、実施後のレポートなどにお答えします。",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <PageHero
        en="FAQ"
        title="よくある質問"
        lead="インフルエンサーPRのご依頼について、よくいただくご質問をまとめました。"
        breadcrumb={[{ label: "よくある質問", href: "/faq" }]}
      />
      <section className="section">
        <div className="container-x max-w-4xl!">
          <FAQAccordion items={faq} />
          <p className="mt-10 text-sm text-muted">
            掲載のない内容についても、お問い合わせフォームまたはInstagram DMからお気軽にご質問ください。
          </p>
        </div>
      </section>
      <FinalCTA />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
    </>
  );
}
