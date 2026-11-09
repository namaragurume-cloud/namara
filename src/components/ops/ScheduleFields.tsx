"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FlexSchedule } from "@/lib/ops/types";
import { cn } from "@/lib/utils";
import { inputClass } from "./ui";

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

/** 撮影日時の決め方（候補日を決める／期間と時間帯から選んでもらう）の切り替え */
export function ScheduleFields({
  initialMode,
  flex,
  fixedEditor,
  excludeCalendar,
}: {
  initialMode: "fixed" | "flex";
  flex?: FlexSchedule;
  /** 候補日の入力欄（SlotEditor） */
  fixedEditor: ReactNode;
  /** 撮影できない日のカレンダー（DateCalendar） */
  excludeCalendar: ReactNode;
}) {
  const [mode, setMode] = useState(initialMode);
  const root = useRef<HTMLDivElement>(null);
  // 読み込み途中に選ばれていた場合も反映する
  useEffect(() => {
    const v = root.current?.querySelector<HTMLInputElement>('input[name="scheduling"]:checked')?.value;
    if (v === "fixed" || v === "flex") setMode(v);
  }, []);
  const f = flex;
  return (
    <div ref={root} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["fixed", "候補日を決める", "撮影できる日時が限られているとき。発信者は候補の中から参加できる日時をすべて選びます"],
            ["flex", "期間と時間帯から選んでもらう", "幅広く調整できるとき。発信者は期間・時間帯の中から第1〜第3希望の日時を選びます"],
          ] as const
        ).map(([v, title, sub]) => (
          <label key={v} className={cn("rounded-xl border px-3 py-2.5 text-sm", mode === v ? "border-brand bg-brand/5" : "border-line bg-white")}>
            <input type="radio" name="scheduling" value={v} defaultChecked={initialMode === v} onChange={() => setMode(v)} className="mr-2 accent-[var(--brand)]" />
            <b>{title}</b>
            <span className="mt-0.5 block text-xs text-muted">{sub}</span>
          </label>
        ))}
      </div>

      <div className={mode === "fixed" ? "" : "hidden"}>{fixedEditor}</div>

      <div className={cn("space-y-3 rounded-xl border border-line bg-white p-3", mode === "flex" ? "" : "hidden")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-bold">期間（開始日）</span>
            <input type="date" name="flexFrom" defaultValue={f?.from} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold">期間（終了日）</span>
            <input type="date" name="flexTo" defaultValue={f?.to} className={inputClass} />
          </label>
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-bold">撮影できる曜日</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEK.map((w, i) => (
              <label key={w} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                <input type="checkbox" name="flexWeekdays" value={i} defaultChecked={f ? f.weekdays.includes(i) : true} className="accent-[var(--brand)]" />
                {w}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <label className="block text-sm">
            <span className="mb-1 block font-bold">時間帯（から）</span>
            <input type="time" name="flexStart" defaultValue={f?.start ?? "11:00"} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold">時間帯（まで）</span>
            <input type="time" name="flexEnd" defaultValue={f?.end ?? "21:00"} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold">1回の撮影</span>
            <select name="flexDuration" defaultValue={String(f?.durationMin ?? 60)} className={inputClass}>
              {[30, 60, 90, 120, 150, 180].map((m) => (
                <option key={m} value={m}>
                  {m}分
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold">開始時刻の刻み</span>
            <select name="flexStep" defaultValue={String(f?.stepMin ?? 30)} className={inputClass}>
              {[15, 30, 60].map((m) => (
                <option key={m} value={m}>
                  {m}分ごと
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold">同じ時間の人数</span>
            <input type="number" name="flexCapacity" min={1} max={20} defaultValue={f?.capacity ?? 2} className={inputClass} />
          </label>
        </div>
        <p className="text-xs text-muted">「同じ時間の人数」は、同じ開始時刻にお店に入れる人数の上限です（同伴者を含む）。</p>
        <div>
          <p className="mb-1 text-sm font-bold">撮影できない日（任意）</p>
          {excludeCalendar}
        </div>
      </div>
    </div>
  );
}
