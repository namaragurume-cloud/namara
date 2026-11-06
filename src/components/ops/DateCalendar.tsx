"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/ops/dates";
import { cn } from "@/lib/utils";

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

const ymd = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * 月のカレンダーから日付を選ぶ。
 *  - multi：何日でも選べる（案件の投稿日など）
 *  - single：1日だけ選ぶ。allowed を渡すとその日だけ選べる（発信者が投稿日を選ぶなど）
 * 選んだ日付は name の hidden input として送信されます。
 */
export function DateCalendar({
  name,
  mode,
  initial = [],
  allowed,
  today,
}: {
  name: string;
  mode: "multi" | "single";
  initial?: string[];
  allowed?: string[];
  /** 今日（YYYY-MM-DD）。これより前は選べない */
  today: string;
}) {
  const [selected, setSelected] = useState<string[]>([...new Set(initial)].sort());
  const start = (selected[0] ?? allowed?.find((d) => d >= today) ?? allowed?.[0] ?? today).slice(0, 7);
  const [month, setMonth] = useState(start); // YYYY-MM
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1;
  const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const allowedSet = allowed ? new Set(allowed) : null;
  const move = (delta: number) => {
    const d = new Date(Date.UTC(y, m + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const toggle = (d: string) =>
    setSelected((cur) => (mode === "single" ? (cur[0] === d ? [] : [d]) : cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

  return (
    <div className="rounded-xl border border-line bg-white p-3">
      {selected.map((d) => (
        <input key={d} type="hidden" name={name} value={d} />
      ))}
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} className="rounded-lg px-3 py-1 text-lg font-bold hover:bg-mist" aria-label="前の月">
          ‹
        </button>
        <b className="num text-sm">
          {y}年{m + 1}月
        </b>
        <button type="button" onClick={() => move(1)} className="rounded-lg px-3 py-1 text-lg font-bold hover:bg-mist" aria-label="次の月">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEK.map((w, i) => (
          <span key={w} className={cn("py-1 font-bold", i === 0 ? "text-rose-600" : i === 6 ? "text-sky-700" : "text-muted")}>
            {w}
          </span>
        ))}
        {Array.from({ length: firstDow }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = ymd(y, m, i + 1);
          const isSel = selected.includes(d);
          const isAllowed = allowedSet ? allowedSet.has(d) : true;
          const disabled = !isAllowed || (d < today && !isSel);
          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => toggle(d)}
              aria-pressed={isSel}
              aria-label={fmtDate(d)}
              className={cn(
                "num aspect-square rounded-lg text-sm",
                isSel ? "bg-brand font-bold text-white" : disabled ? "text-zinc-300" : allowedSet ? "bg-brand/10 font-bold text-brand hover:bg-brand/20" : "hover:bg-mist",
                d === today && !isSel && "ring-1 ring-inset ring-zinc-400",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">
        {selected.length ? (
          <>
            選択中：<b className="text-ink">{selected.map(fmtDate).join("・")}</b>
          </>
        ) : mode === "multi" ? (
          "日付をタップして選んでください（複数選べます）"
        ) : allowedSet ? (
          "色のついた日から選んでください"
        ) : (
          "日付をタップして選んでください"
        )}
      </p>
    </div>
  );
}
