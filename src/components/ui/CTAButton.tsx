"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { InstagramIcon } from "./InstagramIcon";

type Variant = "primary" | "dark" | "outline" | "outline-light" | "light" | "text";

type Props = {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: "md" | "lg";
  icon?: "arrow" | "external" | "instagram" | "none";
  /** 計測用：どこに置かれたボタンか */
  trackLocation?: string;
  className?: string;
  fullWidth?: boolean;
};

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark shadow-[0_10px_30px_-12px_rgba(199,62,51,0.7)]",
  dark: "bg-ink text-white hover:bg-black",
  outline: "border border-ink/20 text-ink hover:border-ink hover:bg-ink hover:text-white",
  "outline-light": "border border-white/40 text-white hover:bg-white hover:text-ink hover:border-white",
  light: "bg-white text-ink hover:bg-mist",
  text: "text-ink px-0! min-h-0! hover:text-brand",
};

export function CTAButton({
  href,
  children,
  variant = "primary",
  size = "md",
  icon = "arrow",
  trackLocation,
  className,
  fullWidth,
}: Props) {
  const external = /^https?:\/\//.test(href);
  const isInstagram = href.includes("instagram.com") || href.includes("ig.me");

  const onClick = () => {
    if (isInstagram) track("instagram_click", { location: trackLocation });
    else track("cta_click", { location: trackLocation, href });
  };

  const classes = cn(
    "group relative inline-flex items-center justify-center gap-3 rounded-full font-bold tracking-wider transition-all duration-300 ease-out-expo",
    "active:scale-[0.98]",
    size === "lg" ? "min-h-[60px] px-8 text-[15px] md:px-10 md:text-base" : "min-h-[52px] px-7 text-sm",
    variants[variant],
    fullWidth && "w-full",
    className,
  );

  const iconEl =
    icon === "none" ? null : icon === "instagram" ? (
      <InstagramIcon size={18} className="shrink-0" />
    ) : icon === "external" ? (
      <ArrowUpRight
        size={18}
        aria-hidden="true"
        className="shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
      />
    ) : (
      <span
        aria-hidden="true"
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full transition-transform duration-300 ease-out-expo group-hover:translate-x-1",
          variant === "primary" || variant === "dark" ? "bg-white/15" : "bg-current/10",
        )}
      >
        <ArrowRight size={15} />
      </span>
    );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes} onClick={onClick}>
        {icon === "instagram" && iconEl}
        <span>{children}</span>
        {icon !== "instagram" && iconEl}
        <span className="sr-only">（新しいタブで開きます）</span>
      </a>
    );
  }

  return (
    <Link href={href} className={classes} onClick={onClick}>
      <span>{children}</span>
      {iconEl}
    </Link>
  );
}
