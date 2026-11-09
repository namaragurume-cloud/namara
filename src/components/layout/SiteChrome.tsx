import type { ReactNode } from "react";
import { Analytics } from "@/components/layout/Analytics";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { StickyCTA } from "@/components/layout/StickyCTA";
import { MotionProvider } from "@/components/animation/MotionProvider";
import { JsonLd } from "@/components/ui/JsonLd";
import { site } from "@/data/site";

/** 公開サイト共通の枠（ヘッダー・フッター・構造化データ・計測） */
export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <MotionProvider>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <StickyCTA />
      </MotionProvider>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${site.url}/#organization`,
              name: site.company.name,
              url: site.url,
              address: {
                "@type": "PostalAddress",
                addressCountry: "JP",
                addressRegion: "北海道",
                addressLocality: "札幌市中央区",
                streetAddress: "南2条西7丁目4-1 2-A",
              },
              sameAs: [site.instagram.url],
            },
            {
              "@type": "WebSite",
              "@id": `${site.url}/#website`,
              name: site.title,
              url: site.url,
              inLanguage: "ja",
              publisher: { "@id": `${site.url}/#organization` },
            },
          ],
        }}
      />
      <Analytics />
    </>
  );
}
