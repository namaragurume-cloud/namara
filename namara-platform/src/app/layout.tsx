import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NAMARA PLATFORM（開発デモ）", template: "%s｜NAMARA PLATFORM" },
  description: "なまらAI（LINEグルメ検索）と NAMARA REVIEW（飲食店向けSaaS）の統合プラットフォーム。開発中のデモです。",
  // 開発中のため検索エンジンに載せない
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
