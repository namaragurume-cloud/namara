"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import { buttonClass, inputClass, type BtnVariant } from "./ui";

/** 送信中は押せないボタン */
export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  confirm,
  name,
  value,
}: {
  children: React.ReactNode;
  variant?: BtnVariant;
  size?: "md" | "sm";
  className?: string;
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={cn(buttonClass(variant, size), className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? "処理中…" : children}
    </button>
  );
}

/** クリップボードにコピー */
export function CopyButton({ text, label = "コピー", size = "sm", variant = "outline" }: { text: string; label?: string; size?: "md" | "sm"; variant?: BtnVariant }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass(variant, size)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "コピーしました" : label}
    </button>
  );
}

type SlotRow = { id: string; date: string; start: string; end: string; capacity: number };

/** 撮影候補日の入力（行の追加・削除） */
export function SlotEditor({ initial }: { initial: SlotRow[] }) {
  const blank = (): SlotRow => ({ id: "", date: "", start: "18:00", end: "20:00", capacity: 1 });
  const [rows, setRows] = useState<SlotRow[]>(initial.length ? initial : [blank()]);
  const set = (i: number, patch: Partial<SlotRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-line p-2 md:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto] md:border-0 md:p-0">
          <input type="hidden" name="slotId" value={r.id} />
          <input aria-label="日付" type="date" name="slotDate" value={r.date} onChange={(e) => set(i, { date: e.target.value })} className={cn(inputClass, "col-span-2 md:col-span-1")} />
          <input aria-label="開始" type="time" name="slotStart" value={r.start} onChange={(e) => set(i, { start: e.target.value })} className={inputClass} />
          <input aria-label="終了" type="time" name="slotEnd" value={r.end} onChange={(e) => set(i, { end: e.target.value })} className={inputClass} />
          <label className="flex items-center gap-1 text-xs text-muted">
            <input aria-label="この枠に入れる発信者の人数" type="number" min={1} max={50} name="slotCapacity" value={r.capacity} onChange={(e) => set(i, { capacity: Number(e.target.value) || 1 })} className={inputClass} />
            <span className="whitespace-nowrap">人まで</span>
          </label>
          <button type="button" onClick={() => setRows((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : [blank()]))} className={buttonClass("outline", "sm")} aria-label="この枠を削除">
            削除
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setRows((x) => [...x, { ...blank(), start: x.at(-1)?.start ?? "18:00", end: x.at(-1)?.end ?? "20:00" }])} className={buttonClass("outline", "sm")}>
        ＋ 候補日を追加
      </button>
    </div>
  );
}

/** 全選択・全解除つきのチェックボックス一覧 */
export function CheckAll({ formId, name }: { formId: string; name: string }) {
  const toggle = (on: boolean) => {
    document.querySelectorAll<HTMLInputElement>(`#${formId} input[name="${name}"]:not(:disabled)`).forEach((el) => (el.checked = on));
  };
  return (
    <span className="flex gap-2">
      <button type="button" className={buttonClass("outline", "sm")} onClick={() => toggle(true)}>
        全員選択
      </button>
      <button type="button" className={buttonClass("outline", "sm")} onClick={() => toggle(false)}>
        解除
      </button>
    </span>
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={cn(buttonClass("dark"), "print:hidden")}>
      PDFで保存・印刷
    </button>
  );
}
