import { MessageCircle } from "lucide-react";

import { StarRating } from "@/components/common/star-rating";
import type { Review, Store } from "@/lib/types";

/**
 * LINE 通知の見え方（Phase 5 で LINE Messaging API の Flex Message として送る内容のプレビュー）。
 * 本文はLINEに全文を載せず、認証済みの承認ページへ誘導する設計。
 */
export function LinePreview({ review, store, draftText }: { review: Review; store: Store; draftText?: string }) {
  return (
    <div className="rounded-2xl bg-[#8cabd9]/25 p-3" aria-label="LINE通知のプレビュー">
      <div className="flex items-start gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white">
          N
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] text-muted-foreground">NAMARA REVIEW</p>
          <div className="overflow-hidden rounded-2xl rounded-tl-sm bg-card shadow-sm">
            <div className="bg-primary px-3 py-2 text-xs font-semibold text-white">新しい口コミが届きました</div>
            <div className="space-y-2 p-3 text-xs">
              <p className="font-semibold">{store.shortName}</p>
              <StarRating rating={review.rating} />
              <p className="line-clamp-3 text-muted-foreground">{review.text || "（評価のみ）"}</p>
              {draftText ? (
                <div className="rounded-md bg-brand-soft p-2 text-primary">
                  <p className="line-clamp-3">AI返信案：{draftText}</p>
                </div>
              ) : null}
            </div>
            <div className="grid border-t text-center text-xs font-semibold text-brand">
              <span className="flex items-center justify-center gap-1 py-2.5">
                <MessageCircle className="size-3.5" aria-hidden />
                確認・承認する
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
