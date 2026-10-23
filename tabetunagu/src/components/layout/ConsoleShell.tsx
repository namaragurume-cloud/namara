import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, LogoMark } from "../ui/Logo";
import { ConsoleNav, type NavItem } from "./ConsoleNav";

export function ConsoleShell({
  title,
  badge,
  nav,
  headerExtra,
  children,
}: {
  title: string;
  badge?: ReactNode;
  nav: NavItem[];
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-paper">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label="ユーザー画面へ" className="shrink-0">
              <LogoMark className="sm:hidden" />
              <span className="hidden sm:inline-flex">
                <Logo />
              </span>
            </Link>
            <span className="hidden h-5 w-px bg-line sm:block" />
            <span className="truncate text-[13px] font-bold text-ink-2">{title}</span>
            {badge}
          </div>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">{headerExtra}</div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-4 lg:grid lg:grid-cols-[200px_1fr] lg:gap-8 lg:py-8">
        <aside className="mb-4 lg:mb-0">
          <div className="lg:sticky lg:top-22">
            <ConsoleNav items={nav} />
          </div>
        </aside>
        <main className="min-w-0 pb-16">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold">{title}</h1>
        {sub && <div className="mt-1 text-[13px] text-muted">{sub}</div>}
      </div>
      {action}
    </div>
  );
}
