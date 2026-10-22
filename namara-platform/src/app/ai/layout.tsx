import Link from "next/link";

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-blue-soft/60 to-paper">
      <header className="border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/ai" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">な</span>
            <span>
              <span className="block text-sm font-bold leading-tight text-ink">なまらAI</span>
              <span className="block text-[10px] leading-tight text-muted">by なまらグルメ ｜ Web版デモ</span>
            </span>
          </Link>
          <Link href="/" className="text-xs text-muted underline">
            デモ一覧へ
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pt-4">{children}</main>
    </div>
  );
}
