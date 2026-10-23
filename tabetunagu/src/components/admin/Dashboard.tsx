import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { num, percent } from "@/lib/format";
import { DASHBOARD_PERIODS, KPI_STATE_LABEL, SEVERITY_LABEL, type DashboardPeriod, type KpiState, type PocKpi, type Severity } from "@/lib/poc-dashboard";
import { cn } from "../ui/cn";

/** 重要度（色だけでなく文字でも示す。赤は「対応必要」だけ） */
const SEVERITY_TONE: Record<Severity, string> = {
  ok: "bg-leaf-soft text-forest-2 border-forest/25",
  warning: "bg-sand text-ink border-ink-2/20",
  critical: "bg-clay-soft text-clay border-clay/30",
};

export function SeverityBadge({ severity, label, className }: { severity: Severity; label?: string; className?: string }) {
  const Icon = severity === "ok" ? CircleCheck : severity === "warning" ? TriangleAlert : CircleAlert;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-bold", SEVERITY_TONE[severity], className)}
      data-severity={severity}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label ?? SEVERITY_LABEL[severity]}
    </span>
  );
}

const KPI_TONE: Record<KpiState, string> = {
  achieved: "bg-leaf-soft text-forest-2",
  near: "bg-sand text-ink",
  missed: "bg-clay-soft text-clay",
  insufficient: "bg-canvas text-ink-2 border border-line",
};

export function KpiCard({ kpi }: { kpi: PocKpi }) {
  const value = kpi.kind === "rate" ? percent(kpi.value) : `${num(kpi.value ?? 0)}${kpi.unit}`;
  const target = kpi.kind === "rate" ? `${percent(kpi.target)}以上` : `${num(kpi.target)}${kpi.unit}程度（Month3）`;
  return (
    <div className="card flex flex-col p-4" data-testid={`kpi-${kpi.key}`} data-state={kpi.state}>
      <p className="text-[13px] font-bold text-ink-2">{kpi.label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="tnum text-[30px] font-bold leading-tight" data-testid="kpi-value">
          {kpi.state === "insufficient" && kpi.value === null ? "—" : value}
        </p>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold", KPI_TONE[kpi.state])} data-testid="kpi-state">
          {KPI_STATE_LABEL[kpi.state]}
        </span>
      </div>
      <p className="tnum text-[12px] text-ink-2" data-testid="kpi-sample">
        {kpi.kind === "rate" ? `${num(kpi.numerator)} / ${num(kpi.denominator)}${kpi.unit}` : "FREE 店舗のうち損益分岐以上"}
      </p>
      <p className="mt-2 border-t border-line pt-2 text-[12px] text-muted">
        目標 <span className="font-semibold text-ink-2">{target}</span>
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted">{kpi.note}</p>
    </div>
  );
}

export function Metric({ label, value, sub, testId, strong }: { label: string; value: ReactNode; sub?: ReactNode; testId?: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-paper px-4 py-3 ring-1 ring-line" data-testid={testId}>
      <p className="text-[12px] font-semibold text-ink-2">{label}</p>
      <p className={cn("tnum mt-0.5 font-bold leading-tight", strong ? "text-[26px]" : "text-[20px]")}>{value}</p>
      {sub && <p className="tnum mt-0.5 text-[11.5px] text-muted">{sub}</p>}
    </div>
  );
}

export function DashSection({
  title,
  sub,
  action,
  children,
  testId,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section data-testid={testId} aria-label={title}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-bold">{title}</h2>
          {sub && <p className="mt-0.5 text-[12px] text-muted">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DashboardPeriodTabs({ period }: { period: DashboardPeriod }) {
  return (
    <nav className="flex gap-1 rounded-full bg-canvas p-1 text-[13px] font-semibold" aria-label="期間" data-testid="dashboard-period">
      {DASHBOARD_PERIODS.map((p) => (
        <Link
          key={p.id}
          href={`/admin?period=${p.id}`}
          aria-current={period === p.id ? "page" : undefined}
          className={cn("rounded-full px-3.5 py-1.5", period === p.id ? "bg-ink text-white" : "text-ink-2")}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
