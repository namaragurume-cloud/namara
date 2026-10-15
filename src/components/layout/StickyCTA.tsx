"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { site } from "@/data/site";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** フォームがあるページでは表示しない */
const HIDDEN_PATHS = ["/contact", "/partner"];

/**
 * スマートフォン用の追従CTA。
 * ファーストビューを過ぎてから表示し、ページ最下部（フッターのCTA付近）では隠します。
 */
export function StickyCTA() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const hidden = HIDDEN_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (hidden) return;
    const onScroll = () => {
      const y = window.scrollY;
      const nearBottom = window.innerHeight + y > document.documentElement.scrollHeight - 900;
      setVisible(y > window.innerHeight * 0.8 && !nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [hidden, pathname]);

  if (hidden) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur-md transition-transform duration-300 md:hidden",
        visible ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
      aria-hidden={!visible}
    >
      <Link
        href="/contact"
        tabIndex={visible ? 0 : -1}
        onClick={() => track("cta_click", { location: "sticky_mobile", href: "/contact" })}
        className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-bold tracking-wider text-white"
      >
        {site.cta}
        <span className="text-xs font-normal opacity-80">｜3万円〜</span>
      </Link>
    </div>
  );
}
