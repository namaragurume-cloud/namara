"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltip } from "./chart-tooltip";

/** 店舗は最大3系列まで（検証済みの色順：青・オレンジ・アクア）。色は店舗に固定して並び順では変えない */
export const STORE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

export function StoreTrendChart({
  data,
  series,
  height = 260,
}: {
  data: Record<string, string | number>[];
  series: { key: string; name: string; color: string }[];
  height?: number;
}) {
  return (
    <div style={{ height }} role="img" aria-label="店舗別の口コミ件数の推移（折れ線グラフ）">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} />
          <Tooltip
            cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                label={label ? String(label) : undefined}
                rows={(payload ?? []).map((p) => ({
                  name: String(p.name),
                  value: `${p.value}件`,
                  color: String(p.color),
                }))}
              />
            )}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => <span style={{ color: "var(--foreground)" }}>{value}</span>}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3, fill: s.color, stroke: "var(--card)", strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
