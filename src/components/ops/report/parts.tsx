import Image from "next/image";
import type { ReactNode } from "react";
import { site } from "@/data/site";
import { cn } from "@/lib/utils";

/**
 * レポート（16:9のスライド）の部品。
 * 色：媒体の色は2色だけ（Instagram＝青、TikTok＝オレンジ。色覚の違いでも見分けられることを確認済み）。
 * 媒体を表さない棒（年齢・反応の内訳など）は、媒体と取り違えないよう落ち着いたグレー系の1色。
 */

export const PLATFORM_COLOR = { instagram: "#2a78d6", tiktok: "#eb6834" } as const;
export const NEUTRAL_BAR = "#4a5b70";

/** 9.2万 / 4,872 */
export function compact(n?: number): string {
  if (n === undefined || !Number.isFinite(n)) return "-";
  if (n >= 10000) return `${(n / 10000).toLocaleString("ja-JP", { maximumFractionDigits: n >= 1_000_000 ? 0 : 1 })}万`;
  return Math.round(n).toLocaleString("ja-JP");
}

export function Slide({ page, total, title, children, className }: { page: number; total: number; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("report-slide relative mx-auto flex w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-sm md:aspect-[16/9] md:p-10", className)}>
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[#eef3fb]" />
      <header className="relative mb-5 flex items-center gap-3 text-xs">
        <Image src="/images/brand/miratsumu-symbol.png" alt="" width={28} height={28} className="size-7" />
        <b className="text-sm">{site.company.name}</b>
        <span className="h-3 w-px bg-line" />
        <span className="truncate text-muted">{title}</span>
        <span className="num ml-auto shrink-0 font-bold text-muted">
          {String(page).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </header>
      <div className="relative min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function Panel({ title, icon, children, className, aside }: { title: string; icon?: ReactNode; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f2] bg-white", className)}>
      <div className="flex items-center gap-2 bg-[#f1f5fb] px-4 py-2.5 text-sm font-bold">
        {icon && <span className="text-[#2a78d6]">{icon}</span>}
        {title}
        {aside && <span className="ml-auto text-xs font-normal text-muted">{aside}</span>}
      </div>
      <div className="min-h-0 flex-1 p-4">{children}</div>
    </div>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#e3e9f2] bg-white">
      <div className="bg-[#f1f5fb] px-3 py-2 text-center text-xs font-bold">{label}</div>
      <div className="flex flex-1 flex-col items-center justify-center px-2 py-4">
        <p className="num text-[clamp(1.4rem,2.6vw,2rem)] font-extrabold leading-none tracking-tight text-[#14213a]">{value}</p>
        {sub && <p className="mt-2 text-center text-[11px] text-muted">{sub}</p>}
      </div>
    </div>
  );
}

export function PlatformTag({ platform }: { platform: "instagram" | "tiktok" }) {
  return (
    <span className="inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold text-white" style={{ background: PLATFORM_COLOR[platform] }}>
      {platform === "instagram" ? "Instagram" : "TikTok"}
    </span>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <span className="flex flex-wrap items-center gap-3 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </span>
  );
}

/** 横棒の一覧（内訳・反応の内訳など）。値の大きさを1色で表す */
export function HBars({ rows, format, color = NEUTRAL_BAR, max }: { rows: { label: string; value: number }[]; format: (v: number) => string; color?: string; max?: number }) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 0);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}：${format(r.value)}`}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span>{r.label}</span>
            <span className="num font-bold text-ink">{format(r.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[#eef1f5]">
            <div className="h-2 rounded-r-[4px]" style={{ width: `${top > 0 ? Math.max(1.5, (r.value / top) * 100) : 0}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 縦棒グラフ（投稿別の閲覧数）。色は媒体。値は棒の上に表示 */
export function Columns({ rows }: { rows: { key: string; label: string; value: number; color: string; tip: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const grid = [0.25, 0.5, 0.75, 1];
  return (
    <div className="flex h-full min-h-48 flex-col">
      <div className="relative flex-1 pt-5">
        <div className="relative h-full">
          {grid.map((g) => (
            <span key={g} aria-hidden className="absolute inset-x-0 border-t border-[#eef1f5]" style={{ bottom: `${g * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end justify-around gap-1 border-b border-[#cfd6df]">
            {rows.map((r) => (
              <div key={r.key} className="group relative flex h-full flex-1 flex-col items-center justify-end" title={r.tip}>
                <span className="num mb-1 whitespace-nowrap text-[10px] font-bold text-ink">{compact(r.value)}</span>
                <div className="w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-80" style={{ height: `${(r.value / max) * 92}%`, background: r.color }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-around gap-1 pt-1.5">
        {rows.map((r) => (
          <span key={r.key} className="flex-1 truncate text-center text-[10px] text-muted">
            {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 合計に対する内訳を1本の帯で（媒体別の閲覧数など） */
export function ShareBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-7 gap-[2px] overflow-hidden rounded-[4px]">
        {parts.map((p) => (
          <div key={p.label} title={`${p.label}：${p.value.toLocaleString("ja-JP")}（${((p.value / total) * 100).toFixed(1)}%）`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="mt-4 space-y-3">
        {parts.map((p) => (
          <li key={p.label} className="flex items-baseline gap-2">
            <span className="size-2.5 self-center rounded-sm" style={{ background: p.color }} />
            <span className="text-sm font-bold">{p.label}</span>
            <span className="num ml-auto text-2xl font-extrabold">{((p.value / total) * 100).toFixed(1)}%</span>
            <span className="num w-24 text-right text-xs text-muted">{p.value.toLocaleString("ja-JP")}回</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 表の中の小さな棒 */
export function InlineBar({ value, max, color }: { value?: number; max: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-[#eef1f5]">
      {value !== undefined && <div className="h-2 rounded-r-[4px]" style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />}
    </div>
  );
}
