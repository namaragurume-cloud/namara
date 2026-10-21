import type { Metadata, Viewport } from "next";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NAMARA REVIEW", template: "%s｜NAMARA REVIEW" },
  description: "口コミ管理は、AIにおまかせ。お店はお客様に集中できる。飲食店向けAI口コミ管理SaaS（なまらグルメ）",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#12284c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
