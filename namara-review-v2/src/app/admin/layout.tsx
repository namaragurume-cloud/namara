import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/layout/logo";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-sidebar text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Logo inverted />
          <span className="ml-1 hidden items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium sm:inline-flex">
            <ShieldCheck className="size-3.5" aria-hidden />
            運営管理（なまらグルメ社内）
          </span>
          <Link href="/dashboard" className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-white/10 hover:text-white">
            <ArrowLeft className="size-4" aria-hidden />
            店舗画面へ
          </Link>
        </div>
      </header>
      <div className="border-b border-warning/20 bg-warning-soft">
        <p className="mx-auto max-w-7xl px-4 py-2 text-xs text-warning sm:px-6 lg:px-8">
          デモでは誰でも開けますが、本番では運営スタッフ専用の権限（店舗ユーザーとは別）でログインした場合のみ表示します（Phase 2で実装）。
        </p>
      </div>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
