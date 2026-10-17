import Link from "next/link";
import { cn } from "../ui/cn";

export function PeriodTabs({ base, period, extra = "" }: { base: string; period: string; extra?: string }) {
  return (
    <div className="flex gap-1 text-[13px] font-semibold">
      {[
        { id: "month", label: "今月" },
        { id: "30d", label: "直近30日" },
        { id: "all", label: "全期間" },
      ].map((p) => (
        <Link key={p.id} href={`${base}?period=${p.id}${extra}`} className={cn("rounded-full px-3.5 py-1.5", period === p.id ? "bg-ink text-white" : "bg-paper text-ink-2")}>
          {p.label}
        </Link>
      ))}
    </div>
  );
}

export function parsePeriod(raw: string | undefined) {
  return raw === "30d" || raw === "all" ? raw : "month";
}
