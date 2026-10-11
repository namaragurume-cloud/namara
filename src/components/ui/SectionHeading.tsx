import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "@/components/animation/ScrollReveal";

type Props = {
  en: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  theme?: "light" | "dark";
  as?: "h1" | "h2";
  className?: string;
};

export function SectionLabel({ children, theme = "light" }: { children: ReactNode; theme?: "light" | "dark" }) {
  return (
    <p
      className={cn(
        "num flex items-center gap-3 text-xs font-semibold tracking-[0.25em] uppercase",
        theme === "dark" ? "text-white/70" : "text-brand",
      )}
    >
      <span aria-hidden="true" className="h-px w-8 bg-current" />
      {children}
    </p>
  );
}

export function SectionHeading({ en, title, lead, align = "left", theme = "light", as = "h2", className }: Props) {
  const Tag = as;
  return (
    <ScrollReveal className={cn(align === "center" && "flex flex-col items-center text-center", className)}>
      <SectionLabel theme={theme}>{en}</SectionLabel>
      <Tag className={cn("heading-lg mt-5", theme === "dark" && "text-white")}>{title}</Tag>
      {lead && (
        <div className={cn("lead mt-6 max-w-2xl", theme === "dark" && "text-white/70")}>{lead}</div>
      )}
    </ScrollReveal>
  );
}
