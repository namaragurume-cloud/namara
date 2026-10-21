import { ThumbsDown, ThumbsUp } from "lucide-react";

import { TOPIC_LABELS } from "@/lib/constants";
import type { ReviewTopic } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TopicChips({ topics, className }: { topics: ReviewTopic[]; className?: string }) {
  if (topics.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="口コミで言及されている内容">
      {topics.map((t, i) => (
        <li
          key={`${t.topic}-${i}`}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
            t.sentiment === "positive" ? "bg-brand-soft text-brand" : "bg-destructive-soft text-destructive",
          )}
        >
          {t.sentiment === "positive" ? <ThumbsUp className="size-3" aria-hidden /> : <ThumbsDown className="size-3" aria-hidden />}
          {TOPIC_LABELS[t.topic]}
          <span className="sr-only">{t.sentiment === "positive" ? "（好評）" : "（不満）"}</span>
          {t.keyword ? <span className="opacity-80">・{t.keyword}</span> : null}
        </li>
      ))}
    </ul>
  );
}
