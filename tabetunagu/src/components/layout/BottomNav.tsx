"use client";

import { Home, QrCode, Search, Ticket, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../ui/cn";

const ITEMS = [
  { href: "/", label: "ホーム", Icon: Home, match: (p: string) => p === "/" },
  { href: "/products", label: "さがす", Icon: Search, match: (p: string) => p.startsWith("/products") || p.startsWith("/stores") },
  { href: "/checkin", label: "QR", Icon: QrCode, match: (p: string) => p.startsWith("/checkin") || p.startsWith("/c/"), primary: true },
  { href: "/reservations", label: "予約", Icon: Ticket, match: (p: string) => p.startsWith("/reservations") || p.startsWith("/done") },
  { href: "/me", label: "マイページ", Icon: User, match: (p: string) => p.startsWith("/me") },
];

export function BottomNav() {
  const pathname = usePathname();
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
