"use client";

import { useState } from "react";
import { fmt } from "./primitives";

export type BarItem = { key: string; label: string; value: number | null; hint?: string; delta?: number | null };

/**
 * 横棒グラフ（1系列）。値が null の行は「少数のため非表示」と表示する。
 * 色は単色（ネイビー）で、値は文字色で表示する。
 */
export function BarList({ items, unit = "回", emptyText = "データがありません" }: { items: BarItem[]; unit?: string; emptyText?: string }) {
  const [active, setActive] = useState<string | null>(null);
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted">{emptyText}</p>;
  const max = Math.max(1, ...items.map((i) => i.value ?? 0));
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li
          key={item.key}
          className="group relative grid grid-cols-[minmax(5.5rem,8rem)_1fr_auto] items-center gap-3 text-sm"
          onMouseEnter={() => setActive(item.key)}
          onMouseLeave={() => setActive(null)}
        >
          <span className="truncate text-ink" title={item.label}>{item.label}</span>
          <span className="relative h-2.5 rounded-r bg-surface">
            {item.value !== null ? (
              <span className="absolute inset-y-0 left-0 rounded-r bg-navy" style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, opacity: active && active !== item.key ? 0.45 : 1 }} />
            ) : (
              <span className="absolute inset-0 rounded-r bg-[repeating-linear-gradient(45deg,#e2e8f0_0_4px,transparent_4px_8px)]" />
            )}
          </span>
          <span className="min-w-[4.5rem] text-right tabular-nums text-ink">
            {item.value !== null ? `${fmt(item.value)}${unit}` : <span className="text-xs text-muted">少数のため非表示</span>}
            {item.delta !== undefined && item.delta !== null && (
              <span className={`ml-1.5 text-xs ${item.delta > 0 ? "text-good" : item.delta < 0 ? "text-bad" : "text-muted"}`}>
                {item.delta > 0 ? "+" : ""}
                {item.delta}%
              </span>
            )}
          </span>
          {active === item.key && item.hint && (
            <span role="tooltip" className="pointer-events-none absolute -top-8 left-24 z-10 rounded-md bg-ink px-2 py-1 text-xs text-white shadow">
              {item.hint}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** 日別の推移（1系列の折れ線）。ホバーで日付と値を表示する */
export function LineChart({ series, unit = "回", label }: { series: { date: string; value: number }[]; unit?: string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 640;
  const height = 180;
  const pad = { top: 12, right: 12, bottom: 24, left: 36 };
  const max = Math.max(1, ...series.map((p) => p.value));
  const niceMax = Math.ceil(max / 5) * 5;
  const x = (i: number) => pad.left + (i / Math.max(1, series.length - 1)) * (width - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - v / niceMax) * (height - pad.top - pad.bottom);
  const path = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const hovered = hover !== null ? series[hover] : undefined;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${label}の日別推移`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * width;
          const i = Math.round(((px - pad.left) / (width - pad.left - pad.right)) * (series.length - 1));
          setHover(Math.min(series.length - 1, Math.max(0, i)));
        }}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(niceMax * t)} y2={y(niceMax * t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y(niceMax * t) + 4} textAnchor="end" fontSize={10} fill="#64748b">
              {fmt(Math.round(niceMax * t))}
            </text>
          </g>
        ))}
        {series.map((p, i) =>
          i % 7 === 0 ? (
            <text key={p.date} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="#64748b">
              {p.date.slice(5).replace("-", "/")}
            </text>
          ) : null,
        )}
        <path d={path} fill="none" stroke="var(--navy)" strokeWidth={2} strokeLinejoin="round" />
        {hover !== null && hovered && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={height - pad.bottom} stroke="#94a3b8" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(hovered.value)} r={4} fill="var(--navy)" stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute top-0 right-0 rounded-md bg-ink px-2 py-1 text-xs text-white shadow">
          {hovered.date}：{fmt(hovered.value)}
          {unit}
        </div>
      )}
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer">表で見る</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {series.map((p) => (
              <tr key={p.date} className="border-t border-line">
                <td className="py-0.5">{p.date}</td>
                <td className="py-0.5 text-right tabular-nums">{fmt(p.value)}{unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
