import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { LiffBootstrap } from "@/components/liff/LiffBootstrap";
import { brand } from "@/lib/brand";
import { features } from "@/lib/features";
import { getViewer } from "@/server/auth/viewer";
import { env } from "@/server/env";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export function generateMetadata(): Metadata {
  // 機能フラグ（実行時の環境変数）で説明文を切り替えるため、リクエスト時に作る
  const description = features.v2Journey ? brand.descriptionV2 : brand.description;
  return {
    metadataBase: new URL(env.appUrl),
    title: { default: `${brand.name}（${brand.nameJa}）`, template: `%s｜${brand.name}` },
    description,
    applicationName: brand.name,
    openGraph: { type: "website", locale: "ja_JP", siteName: brand.name, title: `${brand.name}｜${brand.tagline}`, description },
    formatDetection: { telephone: false, email: false, address: false },
    robots: env.isProduction ? undefined : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const liffId = env.line.liffId;
  const viewer = liffId ? await getViewer() : null;
  return (
    <html lang="ja" className={inter.variable}>
      <body className="min-h-dvh">
        {liffId && <LiffBootstrap liffId={liffId} loggedIn={Boolean(viewer)} />}
        {children}
      </body>
    </html>
  );
}
