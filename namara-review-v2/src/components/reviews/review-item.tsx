"use client";

import { CornerDownRight, MessageSquareReply, RotateCcw, Sparkles } from "lucide-react";

import { StarRating } from "@/components/common/star-rating";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { Review, Store } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TopicChips } from "./topic-chips";

const ACTION_LABEL: Record<Review["status"], string> = {
  unreplied: "返信案を作成",
  draft: "下書きを編集",
  pending: "返信案を確認",
  publishing: "投稿中…",
  published: "詳細を見る",
  failed: "再試行する",
};

export function ReviewItem({
  review,
  store,
  showStore,
  onOpen,
  compact = false,
}: {
  review: Review;
  store?: Store;
  showStore?: boolean;
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  const ActionIcon =
    review.status === "published" ? MessageSquareReply : review.status === "failed" ? RotateCcw : Sparkles;
  return (
    <article
      className={cn(
        "group flex flex-col gap-3 border-b px-4 py-4 last:border-b-0 sm:px-5",
        review.rating <= 2 && review.status !== "published" && "bg-destructive-soft/30",
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StarRating rating={review.rating} />
        <span className="text-sm font-semibold">{review.author}</span>
        <time dateTime={review.createdAt} title={formatDateTime(review.createdAt)} className="text-xs text-muted-foreground">
          {formatRelative(review.createdAt)}
        </time>
        {showStore && store ? (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">{store.shortName}</span>
        ) : null}
        <span className="ml-auto">
          <StatusBadge status={review.status} />
        </span>
      </header>
      {review.text ? (
        <p className={cn("text-sm leading-relaxed", compact && "line-clamp-2")}>{review.text}</p>
      ) : (
        <p className="text-sm text-muted-foreground">（評価のみの投稿・本文なし）</p>
      )}
      {!compact ? <TopicChips topics={review.topics} /> : null}
      {!compact && review.publishedReply ? (
        <div className="flex gap-2 rounded-lg bg-muted/70 p-3 text-sm">
          <CornerDownRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              オーナーからの返信・{formatRelative(review.publishedReply.publishedAt)}
            </p>
            <p className="mt-1 line-clamp-2 whitespace-pre-line text-muted-foreground">{review.publishedReply.text}</p>
          </div>
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button
          size="sm"
          variant={review.status === "published" ? "ghost" : review.status === "failed" ? "destructive" : "outline"}
          disabled={review.status === "publishing"}
          onClick={() => onOpen(review.id)}
        >
          <ActionIcon aria-hidden />
          {ACTION_LABEL[review.status]}
        </Button>
      </div>
    </article>
  );
}
