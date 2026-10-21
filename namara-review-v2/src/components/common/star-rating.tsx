import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function StarRating({ rating, size = "sm", className }: { rating: number; size?: "sm" | "md"; className?: string }) {
  const iconSize = size === "sm" ? "size-3.5" : "size-4.5";
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`5段階中${rating}の評価`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(iconSize, i <= rating ? "fill-star text-star" : "fill-muted text-border")}
        />
      ))}
    </span>
  );
}
