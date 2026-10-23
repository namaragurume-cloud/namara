"use client";

import { Heart, Home, QrCode, ReceiptText, Search, Ticket, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../ui/cn";

type Item = { href: string; label: string; Icon: typeof Home; match: (p: string) => boolean; primary?: boolean };

/** 旧フロー（予約 → 店頭 QR） */
const LEGACY_ITEMS: Item[] = [
  { href: "/", label: "ホーム", Icon: Home, match: (p: string) => p === "/" },
  { href: "/products", label: "さがす", Icon: Search, match: (p: string) => p.startsWith("/products") || p.startsWith("/stores") },
  { href: "/checkin", label: "QR", Icon: QrCode, match: (p: string) => p.startsWith("/checkin") || p.startsWith("/c/"), primary: true },
  { href: "/reservations", label: "予約", Icon: Ticket, match: (p: string) => p.startsWith("/reservations") || p.startsWith("/done") },
  { href: "/me", label: "マイページ", Icon: User, match: (p: string) => p.startsWith("/me") },
];

/** v2（事前決済）: ホーム・探す・注文・お気に入り・マイページ */
const V2_ITEMS: Item[] = [
  { href: "/", label: "ホーム", Icon: Home, match: (p: string) => p === "/" },
  { href: "/products", label: "探す", Icon: Search, match: (p: string) => p.startsWith("/products") || p.startsWith("/stores") },
  { href: "/orders", label: "注文", Icon: ReceiptText, match: (p: string) => p.startsWith("/orders") },
  { href: "/favorites", label: "お気に入り", Icon: Heart, match: (p: string) => p.startsWith("/favorites") },
  { href: "/me", label: "マイページ", Icon: User, match: (p: string) => p.startsWith("/me") },
];

export function BottomNav({ v2 = false }: { v2?: boolean }) {
  const pathname = usePathname();
  const ITEMS = v2 ? V2_ITEMS : LEGACY_ITEMS;
  return (
    <nav
      aria-label="メインメニュー"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {ITEMS.map(({ href, label, Icon, match, primary }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-[60px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold", active ? "text-forest" : "text-muted")}
              >
                {primary ? (
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", active ? "bg-forest-2 text-white" : "bg-forest text-white")}>
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                ) : (
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                )}
                <span className={primary ? "sr-only" : undefined}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
