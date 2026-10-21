import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 前期比の表示。色だけに頼らず、矢印と符号付きの数値で増減を示す。
 * goodWhen: 増えると良い指標は "up"、減ると良い指標（未返信など）は "down"
 */
export function Delta({
  value,
  unit = "%",
  digits = 0,
  goodWhen = "up",
  label,
  className,
}: {
  value: number | null;
  unit?: string;
  digits?: number;
  goodWhen?: "up" | "down";
  label?: string;
  className?: string;
}) {
  if (value === null || Number.isNaN(value)) {
    return <span className={cn("text-xs text-muted-foreground", className)}>{label ? `${label} —` : "比較データなし"}</span>;
  }
  const rounded = Number(value.toFixed(digits));
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const good = direction === "flat" ? null : direction === goodWhen;
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular",
        good === true && "text-success",
        good === false && "text-destructive",
        good === null && "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label ? <span className="mr-0.5 font-normal text-muted-foreground">{label}</span> : null}
      {rounded > 0 ? "+" : ""}
      {rounded.toFixed(digits)}
      {unit}
    </span>
  );
}
