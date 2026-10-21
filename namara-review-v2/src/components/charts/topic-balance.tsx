import type { TopicStat } from "@/lib/analytics";

/**
 * カテゴリ別のポジティブ／ネガティブ件数（左右に分かれた棒）。
 * 色だけでなく「好評」「不満」のラベルと件数を必ず併記する。
 */
export function TopicBalance({ data }: { data: TopicStat[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.positive, d.negative)));
  return (
    <div>
      <div className="mb-2 grid grid-cols-[1fr_4.5rem_1fr] gap-2 text-xs text-muted-foreground">
        <span className="flex items-center justify-end gap-1.5">
          <span className="size-2 rounded-full bg-[var(--chart-negative)]" aria-hidden />
          不満
        </span>
        <span />
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--chart-positive)]" aria-hidden />
          好評
        </span>
      </div>
      <ul className="space-y-2" aria-label="カテゴリ別の評価">
        {data.map((row) => (
          <li key={row.topic} className="grid grid-cols-[1fr_4.5rem_1fr] items-center gap-2 text-xs">
            <span className="flex items-center justify-end gap-1.5">
              <span className="text-muted-foreground tabular">{row.negative}</span>
              <span
                className="h-3 rounded-l-sm rounded-r-[3px] bg-[var(--chart-negative)]"
                style={{ width: `${(row.negative / max) * 100}%`, minWidth: row.negative ? 3 : 0 }}
              />
            </span>
            <span className="text-center text-sm font-medium">{row.label}</span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-3 rounded-l-[3px] rounded-r-sm bg-[var(--chart-positive)]"
                style={{ width: `${(row.positive / max) * 100}%`, minWidth: row.positive ? 3 : 0 }}
              />
              <span className="text-muted-foreground tabular">{row.positive}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
