"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Search, SearchX, Star, X } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dispatch, useAccessibleStores, useDemoState, useScopedReviews } from "@/lib/demo/store";
import type { Review } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ReplyEditorSheet } from "./reply-editor-sheet";
import { ReviewItem } from "./review-item";

type StatusFilter = "all" | "unreplied" | "pending" | "failed" | "published";
type SortKey = "newest" | "oldest" | "lowest" | "highest";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "すべての状態" },
  { value: "unreplied", label: "未返信（下書き含む）" },
  { value: "pending", label: "承認待ち" },
  { value: "failed", label: "投稿失敗" },
  { value: "published", label: "返信済み" },
];

const PAGE_SIZE = 20;

function matchStatus(review: Review, filter: StatusFilter) {
  switch (filter) {
    case "all":
      return true;
    case "unreplied":
      return review.status === "unreplied" || review.status === "draft";
    case "pending":
      return review.status === "pending";
    case "failed":
      return review.status === "failed";
    case "published":
      return review.status === "published" || review.status === "publishing";
  }
}

function parseStatus(value: string | null): StatusFilter {
  return STATUS_OPTIONS.some((o) => o.value === value) ? (value as StatusFilter) : "all";
}

export function ReviewsView() {
  const searchParams = useSearchParams();
  const reviews = useScopedReviews();
  const stores = useAccessibleStores();
  const selectedStore = useDemoState((s) => s.selectedStoreId);

  const [query, setQuery] = useState("");
  const [ratings, setRatings] = useState<number[]>([]);
  const [status, setStatus] = useState<StatusFilter>(() => parseStatus(searchParams.get("status")));
  const [sort, setSort] = useState<SortKey>("newest");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);

  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = reviews.filter(
      (r) =>
        matchStatus(r, status) &&
        (ratings.length === 0 || ratings.includes(r.rating)) &&
        (!q || r.text.toLowerCase().includes(q) || r.author.toLowerCase().includes(q)),
    );
    const sorted = [...list];
    if (sort === "oldest") sorted.reverse();
    if (sort === "lowest") sorted.sort((a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt));
    if (sort === "highest") sorted.sort((a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [reviews, query, ratings, status, sort]);

  const counts = useMemo(() => {
    const result = { unreplied: 0, pending: 0, failed: 0 };
    for (const r of reviews) {
      if (matchStatus(r, "unreplied")) result.unreplied++;
      if (r.status === "pending") result.pending++;
      if (r.status === "failed") result.failed++;
    }
    return result;
  }, [reviews]);

  const hasFilter = query !== "" || ratings.length > 0 || status !== "all";
  const visible = filtered.slice(0, limit);

  function toggleRating(rating: number) {
    setLimit(PAGE_SIZE);
    setRatings((prev) => (prev.includes(rating) ? prev.filter((r) => r !== rating) : [...prev, rating]));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="口コミ管理"
        description="Googleの口コミを確認し、AIの返信案を作成・承認します。"
      />

      <div className="grid grid-cols-3 gap-2 sm:max-w-xl">
        {(
          [
            ["unreplied", "未返信", counts.unreplied],
            ["pending", "承認待ち", counts.pending],
            ["failed", "投稿失敗", counts.failed],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setStatus(status === value ? "all" : value);
              setLimit(PAGE_SIZE);
            }}
            aria-pressed={status === value}
            className={cn(
              "cursor-pointer rounded-xl border bg-card px-3 py-2.5 text-left transition-colors hover:border-brand/40",
              status === value && "border-brand bg-brand-soft",
            )}
          >
            <span className="block text-xs text-muted-foreground">{label}</span>
            <span
              className={cn(
                "text-xl font-bold tabular",
                value === "failed" && count > 0 ? "text-destructive" : "text-primary",
              )}
            >
              {count}
              <span className="ml-0.5 text-xs font-normal text-muted-foreground">件</span>
            </span>
          </button>
        ))}
      </div>

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder="キーワード・投稿者名で検索（例：タン塩、待ち時間）"
              className="pl-9"
              aria-label="口コミを検索"
            />
          </div>
          {stores.length > 1 ? (
            <Select value={selectedStore} onValueChange={(v) => dispatch({ type: "selectStore", storeId: v })}>
              <SelectTrigger className="md:w-52" aria-label="店舗">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全店舗</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as StatusFilter);
              setLimit(PAGE_SIZE);
            }}
          >
            <SelectTrigger className="md:w-48" aria-label="返信状況">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="md:w-40" aria-label="並び順">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">新しい順</SelectItem>
              <SelectItem value="oldest">古い順</SelectItem>
              <SelectItem value="lowest">評価が低い順</SelectItem>
              <SelectItem value="highest">評価が高い順</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="星評価で絞り込み">
          <span className="text-xs text-muted-foreground">星評価</span>
          {[5, 4, 3, 2, 1].map((rating) => (
            <button
              key={rating}
              type="button"
              aria-pressed={ratings.includes(rating)}
              onClick={() => toggleRating(rating)}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border px-3 text-sm transition-colors",
                ratings.includes(rating) ? "border-brand bg-brand-soft text-brand" : "bg-card hover:bg-muted",
              )}
            >
              <Star className="size-3.5 fill-star text-star" aria-hidden />
              {rating}
            </button>
          ))}
          {hasFilter ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setQuery("");
                setRatings([]);
                setStatus("all");
                setLimit(PAGE_SIZE);
              }}
            >
              <X aria-hidden />
              条件をクリア
            </Button>
          ) : null}
        </div>
      </Card>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered.length}件の口コミ{hasFilter ? "（絞り込み中）" : ""}
      </p>

      <Card className="overflow-hidden">
        {visible.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="条件に合う口コミがありません"
            description="検索キーワードや絞り込み条件を変更してください。"
          />
        ) : (
          visible.map((review) => (
            <ReviewItem
              key={review.id}
              review={review}
              store={storeById.get(review.storeId)}
              showStore={selectedStore === "all"}
              onOpen={setOpenId}
            />
          ))
        )}
      </Card>

      {filtered.length > limit ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            さらに表示（残り{filtered.length - limit}件）
          </Button>
        </div>
      ) : null}

      <ReplyEditorSheet reviewId={openId} onOpenChange={(open) => !open && setOpenId(null)} />
    </div>
  );
}
