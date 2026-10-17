"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../ui/cn";

export type NavItem = { href: string; label: string; exact?: boolean };

/** 店舗・管理画面のナビ（PC はサイドバー、スマホは横スクロール） */
export function ConsoleNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="管理メニュー" className="no-print">
      <ul className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition-colors",
                  active ? "bg-ink text-white" : "text-ink-2 hover:bg-canvas",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
