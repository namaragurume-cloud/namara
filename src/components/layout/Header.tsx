"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { mainNav, site } from "@/data/site";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { InstagramIcon } from "@/components/ui/InstagramIcon";
import { Logo } from "@/components/ui/Logo";

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  // ページ遷移でメニューを閉じる
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // メニュー表示中：スクロール固定・Esc で閉じる・フォーカスをメニュー内に留める
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const first = menuRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && menuRef.current) {
        const items = [
          menuButtonRef.current,
          ...menuRef.current.querySelectorAll<HTMLElement>("a, button"),
        ].filter(Boolean) as HTMLElement[];
        const i = items.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          items[items.length - 1].focus();
        } else if (!e.shiftKey && i === items.length - 1) {
          e.preventDefault();
          items[0].focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const transparent = isHome && !scrolled && !open;

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[100] rounded-md bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        本文へスキップ
      </a>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,color] duration-500",
          transparent
            ? "bg-transparent text-white"
            : open
              ? "bg-white text-ink shadow-[0_1px_0_rgba(0,0,0,0.06)]"
              : "bg-white/90 text-ink shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-xl",
        )}
      >
        <div className="container-x flex h-[var(--header-h)] items-center justify-between gap-6">
          <Link href="/" aria-label={`${site.brand} トップページ`} className="shrink-0">
            <Logo light={transparent} />
          </Link>

          <nav aria-label="メインメニュー" className="hidden xl:block">
            <ul className="flex items-center gap-1">
              {mainNav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative rounded-full px-4 py-2 text-[13.5px] font-bold tracking-wider whitespace-nowrap transition-colors",
                        "after:absolute after:inset-x-4 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 hover:after:scale-x-100",
                        active && "text-brand after:scale-x-100",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/contact"
              onClick={() => track("cta_click", { location: "header", href: "/contact" })}
              className="group hidden items-center gap-2 rounded-full bg-brand px-6 py-3 text-[13.5px] font-bold tracking-wider whitespace-nowrap text-white transition-all duration-300 hover:bg-brand-dark sm:inline-flex"
            >
              無料でPRプランを相談する
            </Link>
            <Link
              href="/contact"
              onClick={() => track("cta_click", { location: "header_mobile", href: "/contact" })}
              className="inline-flex min-h-11 items-center rounded-full bg-brand px-4 text-[13px] font-bold tracking-wider text-white sm:hidden"
            >
              相談する
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "メニューを閉じる" : "メニューを開く"}
              onClick={() => (open ? close() : setOpen(true))}
              className="grid size-11 place-items-center rounded-full transition-colors hover:bg-current/10 xl:hidden"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* モバイルメニュー */}
      <div
        id="mobile-menu"
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label="メニュー"
        hidden={!open}
        className="fixed inset-0 top-[var(--header-h)] z-40 overflow-y-auto bg-white xl:hidden"
      >
        <nav aria-label="モバイルメニュー" className="container-x flex min-h-full flex-col pt-6 pb-10">
          <ul className="divide-y divide-line border-y border-line">
            {[...mainNav, { href: "/faq", label: "よくある質問", en: "FAQ" }].map((item, i) => (
              <li key={item.href} className="anim-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                <Link href={item.href} className="flex items-center justify-between py-5" onClick={close}>
                  <span className="text-lg font-bold">{item.label}</span>
                  <span className="num text-[11px] font-semibold tracking-[0.2em] text-muted">{item.en}</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-2xl bg-ink p-6 text-white">
            <p className="text-sm font-bold">企業・店舗のご担当者様へ</p>
            <p className="mt-2 text-xs leading-relaxed text-white/70">
              目的やご予算に合わせて、最適なグルメPRをご提案します。
            </p>
            <Link
              href="/contact"
              onClick={() => {
                track("cta_click", { location: "mobile_menu", href: "/contact" });
                close();
              }}
              className="mt-5 flex min-h-14 items-center justify-center rounded-full bg-brand font-bold tracking-wider"
            >
              無料でPRプランを相談する
            </Link>
            <a
              href={site.instagram.dmUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("instagram_click", { location: "mobile_menu" })}
              className="mt-3 flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/30 text-sm font-bold tracking-wider"
            >
              <InstagramIcon size={18} />
              Instagram DMで相談
            </a>
          </div>

          <Link href="/partner" onClick={close} className="mt-6 text-center text-sm text-muted underline underline-offset-4">
            インフルエンサーの方はこちら
          </Link>
        </nav>
      </div>
    </>
  );
}
