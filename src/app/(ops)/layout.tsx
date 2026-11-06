import type { Metadata } from "next";

/** ログイン状態・最新データに依存するため、すべて都度表示（静的生成しない） */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "MIRATSUMU 業務ツール", template: "%s｜MIRATSUMU" },
  robots: { index: false, follow: false },
};

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh bg-mist text-[15px] leading-relaxed">{children}</div>;
}
