import Link from "next/link";
import { corp, corpNav } from "@/data/corp";
import { site } from "@/data/site";

/** 社名ロゴ（ロゴ画像が届くまではテキスト表示） */
export function CorpLogo({ light }: { light?: boolean }) {
  return (
    <span className="inline-flex flex-col leading-none">
      <span className={`num text-[17px] font-extrabold tracking-[0.12em] ${light ? "text-white" : "text-ink"}`}>
        NORTH PLEASURE
      </span>
      <span className={`mt-1 text-[10px] font-bold tracking-[0.2em] ${light ? "text-white/70" : "text-muted"}`}>
        株式会社ノースプレジャー
      </span>
    </span>
  );
}

export function CorpHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-md">
      <div className="container-x flex h-16 items-center justify-between gap-6 md:h-20">
        <Link href="/corp" aria-label={`${corp.name} トップページ`}>
          <CorpLogo />
        </Link>
        <nav aria-label="メインメニュー" className="hidden md:block">
          <ul className="flex items-center gap-8 text-sm font-bold">
            {corpNav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="transition-colors hover:text-brand">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link
          href="/corp/contact"
          className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-brand md:hidden"
        >
          お問い合わせ
        </Link>
      </div>
      <nav aria-label="メニュー" className="border-t border-line md:hidden">
        <ul className="scrollbar-none container-x flex gap-6 overflow-x-auto py-2.5 text-[13px] font-bold whitespace-nowrap">
          {corpNav.slice(0, 3).map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="text-ink/70">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export function CorpFooter() {
  return (
    <footer className="bg-ink text-white">
      <div className="container-x grid gap-10 py-16 md:grid-cols-[1.2fr_1fr] md:py-20">
        <div>
          <CorpLogo light />
          <p className="mt-6 text-sm leading-relaxed text-white/70">{site.company.address}</p>
        </div>
        <nav aria-label="フッターメニュー">
          <ul className="grid grid-cols-2 gap-3 text-sm">
            {corpNav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-white/70 transition-colors hover:text-white">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/privacy" className="text-white/70 transition-colors hover:text-white">
                プライバシーポリシー
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <p className="border-t border-white/10 py-6 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {corp.nameEn}
      </p>
    </footer>
  );
}
