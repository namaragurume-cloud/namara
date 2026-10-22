"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PLANS } from "@/lib/constants";
import { syncReviews, useCurrentOrganization, useScopedReviews } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NAV_ITEMS, type NavItem } from "./nav-items";
import { useOrgHref } from "./org-context";
import { StoreSwitcher } from "./store-switcher";
import { UserMenu } from "./user-menu";

function useBadgeCounts() {
  const reviews = useScopedReviews();
  let unreplied = 0;
  let pending = 0;
  for (const r of reviews) {
    if (r.status === "unreplied" || r.status === "draft") unreplied++;
    if (r.status === "pending") pending++;
  }
  return { unreplied, pending };
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const counts = useBadgeCounts();
  const href = useOrgHref();
  return (
    <nav aria-label="メインメニュー" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, href(item.href));
        const count = item.badge ? counts[item.badge] : 0;
        return (
          <Link
            key={item.href}
            href={href(item.href)}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-sidebar-active text-white" : "text-sidebar-foreground hover:bg-white/5 hover:text-white",
            )}
          >
            <item.icon className="size-4.5 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {count > 0 ? (
              <span
                className={cn(
                  "min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular",
                  item.badge === "pending" ? "bg-brand text-white" : "bg-white/15 text-white",
                )}
                aria-label={`${count}件`}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const href = useOrgHref();
  const organization = useCurrentOrganization();
  return (
    <div className="flex h-full flex-col bg-sidebar px-3 py-5">
      <Link href={href("/dashboard")} onClick={onNavigate} className="mb-5 px-2">
        <Logo inverted />
      </Link>
      <div className="mb-5 rounded-lg border border-white/10 px-3 py-2.5">
        <p className="text-[11px] text-sidebar-foreground">ご契約法人</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-white" title={organization.name}>
          {organization.name}
        </p>
        <p className="mt-0.5 text-[11px] text-sidebar-foreground">{PLANS[organization.plan].name}プラン</p>
      </div>
      <SidebarNav onNavigate={onNavigate} />
      <div className="mt-auto rounded-lg bg-white/5 p-3 text-xs leading-relaxed text-sidebar-foreground">
        <p className="font-semibold text-white">デモモード（Phase 1）</p>
        <p className="mt-1">サンプルデータで動作しています。Google・LINE・AIには接続していません。</p>
      </div>
    </div>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();
  const counts = useBadgeCounts();
  const href = useOrgHref();
  return (
    <nav
      aria-label="メインメニュー"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map((item: NavItem) => {
          const active = isActive(pathname, href(item.href));
          const count = item.badge ? counts[item.badge] : 0;
          return (
            <li key={item.href}>
              <Link
                href={href(item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                  active ? "text-brand" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                {item.shortLabel}
                {count > 0 ? (
                  <span className="absolute right-[calc(50%-1.5rem)] top-1 min-w-4.5 rounded-full bg-destructive px-1 text-center text-[10px] leading-4.5 text-white tabular">
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-10"
      disabled={syncing}
      onClick={async () => {
        setSyncing(true);
        const count = await syncReviews();
        setSyncing(false);
        toast.success(`Google口コミを同期しました（新着${count}件・デモ）`);
      }}
    >
      <RefreshCw className={cn(syncing && "animate-spin")} aria-hidden />
      <span className="hidden sm:inline">{syncing ? "同期中…" : "口コミを同期"}</span>
      <span className="sr-only sm:hidden">口コミを同期</span>
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded bg-primary px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        本文へ移動
      </a>
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarBody />
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 border-none p-0">
          <SheetTitle className="sr-only">メニュー</SheetTitle>
          <SidebarBody onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="メニューを開く"
            >
              <Menu className="size-5" />
            </Button>
            <StoreSwitcher className="max-w-[min(20rem,55vw)] flex-1 sm:flex-none" />
            <div className="ml-auto flex items-center gap-2">
              <SyncButton />
              <UserMenu />
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
