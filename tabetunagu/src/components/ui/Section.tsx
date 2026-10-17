import type { ReactNode } from "react";
import { cn } from "./cn";

export function SectionTitle({ title, sub, action, className }: { title: string; sub?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <div>
        <h2 className="text-[17px] font-bold tracking-wide text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-[12px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-canvas px-5 py-10 text-center">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const styles = {
    info: "border-line bg-canvas text-ink-2",
    error: "border-clay/25 bg-clay-soft text-clay",
    success: "border-leaf/25 bg-leaf-soft text-forest",
  } as const;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-[13px] leading-relaxed", styles[tone])}>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("card px-4 py-3.5", className)}>
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className="tnum mt-1 text-[22px] font-semibold leading-tight text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}
