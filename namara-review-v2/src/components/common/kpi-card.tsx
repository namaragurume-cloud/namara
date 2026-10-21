import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  title,
  value,
  unit,
  icon: Icon,
  footer,
  tone = "default",
  className,
}: {
  title: string;
  value: React.ReactNode;
  unit?: string;
  icon: LucideIcon;
  footer?: React.ReactNode;
  tone?: "default" | "attention";
  className?: string;
}) {
  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            tone === "attention" ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{value}</span>
        {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
      </p>
      {footer ? <div className="mt-2 min-h-5">{footer}</div> : null}
    </Card>
  );
}
