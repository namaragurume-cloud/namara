"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { MonthlyPoint } from "@/lib/analytics";
import { monthLabel } from "@/lib/analytics";
import { ChartTooltip } from "./chart-tooltip";

export function RatingTrendChart({ data, height = 240 }: { data: MonthlyPoint[]; height?: number }) {
  const values = data.map((d) => d.average).filter((v): v is number => v !== null);
  const min = values.length ? Math.max(1, Math.floor((Math.min(...values) - 0.3) * 2) / 2) : 1;
  return (
    <div style={{ height }} role="img" aria-label="月別の平均星評価の推移（折れ線グラフ）">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} interval="preserveStartEnd" />
          <YAxis domain={[min, 5]} ticks={Array.from({ length: Math.round((5 - min) * 2) + 1 }, (_, i) => min + i * 0.5)} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} tickFormatter={(v: number) => v.toFixed(1)} />
          <Tooltip
            cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as MonthlyPoint | undefined;
              return (
                <ChartTooltip
                  active={active}
                  label={point ? monthLabel(point.key, true) : undefined}
                  rows={
                    point
                      ? [
                          { name: "平均評価", value: point.average === null ? "—" : `★${point.average.toFixed(2)}`, color: "var(--primary)" },
                          { name: "件数", value: `${point.count}件`, color: "transparent" },
                        ]
                      : []
                  }
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="average"
            name="平均評価"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: "var(--card)", strokeWidth: 2 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
