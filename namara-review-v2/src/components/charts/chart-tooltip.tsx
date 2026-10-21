"use client";

/** Recharts 用の共通ツールチップ。値は文字色（ink）で表示し、系列色はマーカーだけに使う */
export function ChartTooltip({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: string;
  rows: { name: string; value: string; color: string }[];
}) {
  if (!active || rows.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-lg">
      {label ? <p className="mb-1 font-semibold text-foreground">{label}</p> : null}
      {rows.map((row) => (
        <p key={row.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: row.color }} aria-hidden />
          <span>{row.name}</span>
          <span className="ml-auto pl-3 font-semibold text-foreground tabular">{row.value}</span>
        </p>
      ))}
    </div>
  );
}
