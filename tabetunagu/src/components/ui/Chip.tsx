import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function ChipLink({ href, active, children }: { href: string; active?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-[13px] font-semibold transition-colors",
        active ? "border-ink bg-ink text-white" : "border-line bg-paper text-ink-2 hover:border-ink-2/40",
      )}
    >
      {children}
    </Link>
  );
}

export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1", className)}>{children}</div>;
}
