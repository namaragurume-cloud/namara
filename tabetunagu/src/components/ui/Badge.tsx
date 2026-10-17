import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "green" | "sand" | "clay" | "dark" | "outline";
const tones: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-2",
  green: "bg-leaf-soft text-forest",
  sand: "bg-sand text-ink-2",
  clay: "bg-clay-soft text-clay",
  dark: "bg-ink text-white",
  outline: "border border-line text-ink-2",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-5", tones[tone], className)}>
      {children}
    </span>
  );
}
