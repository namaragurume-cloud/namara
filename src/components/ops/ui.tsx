import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 業務ツール共通の小さな部品 */

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-4 shadow-sm md:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-bold md:text-lg">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const tones = {
  gray: "bg-zinc-100 text-zinc-700",
  blue: "bg-sky-100 text-sky-800",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-rose-100 text-rose-800",
  brand: "bg-brand/10 text-brand",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", tones[tone])}>{children}</span>;
}

const btn = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  dark: "bg-ink text-white hover:bg-zinc-700",
  outline: "border border-line bg-white text-ink hover:bg-mist",
  danger: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
} as const;
export type BtnVariant = keyof typeof btn;

export const buttonClass = (variant: BtnVariant = "primary", size: "md" | "sm" = "md") =>
  cn(
    "inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    size === "md" ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs",
    btn[variant],
  );

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: "md" | "sm" }) {
  return <Link {...props} className={cn(buttonClass(variant, size), className)} />;
}

export const inputClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm leading-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Field({ label, hint, children, required }: { label: string; hint?: ReactNode; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold">
        {label}
        {required && <span className="ml-1 text-xs text-brand">必須</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

export function Flash({ text }: { text?: string }) {
  if (!text) return null;
  const isError = text.startsWith("!");
  return (
    <div
      role="status"
      className={cn(
        "whitespace-pre-wrap rounded-xl border px-4 py-3 text-sm leading-relaxed",
        isError ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-900",
      )}
    >
      {isError ? text.slice(1) : text}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-mist px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl bg-mist px-4 py-3">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="num mt-1 text-2xl font-extrabold leading-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
