import type { Progress } from "@/lib/ops/progress";
import { cn } from "@/lib/utils";

/** 回答→撮影→投稿→インサイト→完了 の進み具合 */
export function ProgressSteps({ p, compact }: { p: Progress; compact?: boolean }) {
  if (p.closed) return <span className="text-xs text-muted">見送り</span>;
  return (
    <ol className={cn("flex items-center", compact ? "gap-0.5" : "gap-1")} aria-label={`進捗：${p.status}`}>
      {p.steps.map((s, i) => (
        <li key={s.key} className="flex items-center">
          {i > 0 && <span aria-hidden className={cn("h-0.5", compact ? "w-2" : "w-3", s.state === "todo" ? "bg-zinc-200" : "bg-emerald-500")} />}
          <span
            title={`${s.label}：${s.state === "done" ? "済み" : s.state === "current" ? "いまここ" : "これから"}`}
            className={cn(
              "flex items-center justify-center whitespace-nowrap rounded-full font-bold",
              compact ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-[11px]",
              s.state === "done" && "bg-emerald-500 text-white",
              s.state === "current" && (p.tone === "red" ? "bg-rose-100 text-rose-800 ring-2 ring-rose-400" : p.tone === "amber" ? "bg-amber-100 text-amber-900 ring-2 ring-amber-400" : "bg-sky-100 text-sky-900 ring-2 ring-sky-400"),
              s.state === "todo" && "bg-zinc-100 text-zinc-400",
            )}
          >
            {s.state === "done" ? "✓" : ""}
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
