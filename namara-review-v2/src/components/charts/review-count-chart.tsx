"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { MonthlyPoint } from "@/lib/analytics";
import { monthLabel } from "@/lib/analytics";
import { ChartTooltip } from "./chart-tooltip";

export function ReviewCountChart({ data, height = 260 }: { data: MonthlyPoint[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="月別の口コミ件数の推移（棒グラフ）">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as MonthlyPoint | undefined;
              return (
                <ChartTooltip
                  active={active}
                  label={point ? monthLabel(point.key, true) : undefined}
                  rows={point ? [{ name: "口コミ件数", value: `${point.count}件`, color: "var(--chart-1)" }] : []}
                />
              );
            }}
          />
          <Bar dataKey="count" name="口コミ件数" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
