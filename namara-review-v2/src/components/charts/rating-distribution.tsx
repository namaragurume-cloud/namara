import { Star } from "lucide-react";

export function RatingDistribution({ data }: { data: { rating: number; count: number; percent: number }[] }) {
  return (
    <ul className="space-y-2.5" aria-label="星評価の分布">
      {data.map((row) => (
        <li key={row.rating} className="grid grid-cols-[2.5rem_1fr_6.5rem] items-center gap-3 text-sm">
          <span className="flex items-center gap-1 font-medium tabular">
            {row.rating}
            <Star className="size-3.5 fill-star text-star" aria-hidden />
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-muted" title={`${row.percent.toFixed(1)}%`}>
            <span
              className="block h-full rounded-full"
              style={{
                width: `${row.percent}%`,
                background: row.rating >= 4 ? "var(--chart-1)" : row.rating === 3 ? "#86b6ef" : "var(--chart-negative)",
              }}
            />
          </span>
          <span className="text-right text-xs text-muted-foreground tabular">
            {row.count}件<span className="ml-1">({row.percent.toFixed(0)}%)</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
