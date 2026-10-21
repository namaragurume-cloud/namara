"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { monthLabel } from "@/lib/analytics";
import { formatYen } from "@/lib/format";
import { ChartTooltip } from "./chart-tooltip";

export function RevenueChart({ data, height = 240 }: { data: { key: string; amount: number }[]; height?: number }) {
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.key) }));
  return (
    <div style={{ height }} role="img" aria-label="月次売上の推移（棒グラフ）">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} tickFormatter={(v: number) => `${v / 10000}万`} width={40} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              return (
                <ChartTooltip
                  active={active}
                  label={row ? monthLabel(row.key, true) : undefined}
                  rows={row ? [{ name: "売上（税抜）", value: formatYen(row.amount), color: "var(--primary)" }] : []}
                />
              );
            }}
          />
          <Bar dataKey="amount" name="売上" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
