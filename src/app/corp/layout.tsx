import type { Metadata } from "next";
import { corp } from "@/data/corp";
import { MotionProvider } from "@/components/animation/MotionProvider";
import { Analytics } from "@/components/layout/Analytics";
import { CorpFooter, CorpHeader } from "@/components/corp/CorpChrome";

export const metadata: Metadata = {
  title: { default: `${corp.name}｜北海道の食を発信し、届け、味わう`, template: `%s｜${corp.name}` },
  description: corp.intro,
  applicationName: corp.name,
  openGraph: { siteName: corp.name, title: corp.name, description: corp.intro, url: "/corp" },
  alternates: { canonical: "/corp" },
  // 独自ドメインで公開するまでは検索結果に出さない
  robots: { index: false, follow: false },
};

export default function CorpLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <div className="flex min-h-dvh flex-col bg-white text-ink">
        <CorpHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <CorpFooter />
      </div>
      <Analytics />
    </MotionProvider>
  );
}
