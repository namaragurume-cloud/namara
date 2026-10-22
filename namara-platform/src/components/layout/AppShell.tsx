import Link from "next/link";
import type { ReactNode } from "react";
import { signOutDemo } from "@/app/actions/demo";
import { Badge } from "@/components/ui/primitives";

export type NavItem = { href: string; label: string; active?: boolean; soon?: boolean };

/** NAMARA REVIEW と運営画面で共通の BtoB 向けレイアウト */
export function AppShell({
  product,
  tone,
  nav,
  accountLabel,
  toolbar,
  children,
}: {
  product: string;
  tone: "review" | "admin";
  nav: NavItem[];
  accountLabel: string;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-surface">
      <header className={tone === "admin" ? "bg-navy-dark text-white" : "border-b border-line bg-paper"}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-bold tracking-wide">
              {product}
            </Link>
            <Badge tone={tone === "admin" ? "ad" : "muted"}>デモ</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {toolbar}
            <span className={tone === "admin" ? "text-blue-100" : "text-muted"}>{accountLabel}</span>
            <form action={signOutDemo}>
              <button type="submit" className="underline">
                ログアウト
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto max-w-7xl overflow-x-auto px-4" aria-label="メインメニュー">
          <ul className="flex gap-1 text-sm">
            {nav.map((item) => (
              <li key={item.href}>
                {item.soon ? (
                  <span className={`block whitespace-nowrap px-3 py-2 opacity-50 ${tone === "admin" ? "text-white" : "text-muted"}`} title="今後のフェーズで実装">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    aria-current={item.active ? "page" : undefined}
                    className={`block whitespace-nowrap border-b-2 px-3 py-2 ${
                      item.active
                        ? tone === "admin"
                          ? "border-white font-bold text-white"
                          : "border-navy font-bold text-navy"
                        : tone === "admin"
                          ? "border-transparent text-blue-100 hover:text-white"
                          : "border-transparent text-muted hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

export function AccessDenied({ message, loginHref = "/" }: { message: string; loginHref?: string }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-lg font-bold text-ink">アクセスできません</h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <Link href={loginHref} className="mt-6 inline-block rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white">
        デモアカウントを選ぶ
      </Link>
    </main>
  );
}
