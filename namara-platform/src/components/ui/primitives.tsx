import type { ReactNode } from "react";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ title, description, action, children, className }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-paper p-5 shadow-sm", className)}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-base font-bold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type BadgeTone = "default" | "navy" | "ad" | "good" | "bad" | "muted";
const BADGE_TONES: Record<BadgeTone, string> = {
  default: "bg-blue-soft text-navy",
  navy: "bg-navy text-white",
  ad: "bg-ad-soft text-ad border border-amber-300",
  good: "bg-emerald-50 text-good",
  bad: "bg-red-50 text-bad",
  muted: "bg-surface text-muted border border-line",
};

export function Badge({ children, tone = "default", className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", BADGE_TONES[tone], className)}>{children}</span>;
}

export function Kpi({ label, value, unit, sub, delta, note }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; delta?: number | null; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4 shadow-sm">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-ink tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
        {delta !== undefined && delta !== null && (
          <span className={cn("font-medium tabular-nums", delta > 0 ? "text-good" : delta < 0 ? "text-bad" : "text-muted")}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "±"} {Math.abs(delta)}%
          </span>
        )}
        {sub}
      </div>
      {note && <p className="mt-1 text-[11px] text-muted">{note}</p>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface px-4 py-8 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", tone === "warn" ? "border-amber-200 bg-ad-soft text-amber-900" : "border-blue-100 bg-blue-soft text-navy")}>
      {children}
    </div>
  );
}

/** デモ用合成データであることを示す表示（実測値と区別するため必須） */
export function SyntheticNotice() {
  return (
    <Notice tone="warn">
      <strong>デモ用合成データ：</strong>
      このページの数値は、架空店舗と自動生成した検索ログによるデモ表示です。実際の計測値ではありません。
    </Notice>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export const fmt = (n: number) => n.toLocaleString("ja-JP");
