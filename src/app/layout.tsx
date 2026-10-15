import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { Analytics } from "@/components/layout/Analytics";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { StickyCTA } from "@/components/layout/StickyCTA";
import { MotionProvider } from "@/components/animation/MotionProvider";
import { JsonLd } from "@/components/ui/JsonLd";
import { site } from "@/data/site";
import "./globals.css";

const noto = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-noto",
  display: "swap",
  preload: false,
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.homeTitle,
    template: `%s｜${site.title}`,
  },
  description: site.description,
  applicationName: site.brand,
  keywords: [
    "北海道 インフルエンサーPR",
    "札幌 インフルエンサー",
    "北海道 飲食店 集客",
    "札幌 グルメインフルエンサー",
    "北海道 SNSマーケティング",
    "飲食店 インフルエンサー キャスティング",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: site.locale,
    siteName: site.title,
    title: site.homeTitle,
    description: site.description,
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${noto.variable} ${inter.variable}`}>
      <body>
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
      </body>
    </html>
  );
}
