"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Clock, MessageSquareText, Sparkles, Star, TriangleAlert, Inbox, CalendarDays } from "lucide-react";

import { RatingDistribution } from "@/components/charts/rating-distribution";
import { RatingTrendChart } from "@/components/charts/rating-trend-chart";
import { ReviewCountChart } from "@/components/charts/review-count-chart";
import { Delta } from "@/components/common/delta";
import { EmptyState } from "@/components/common/empty-state";
import { KpiCard } from "@/components/common/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { ReplyEditorSheet } from "@/components/reviews/reply-editor-sheet";
import { ReviewItem } from "@/components/reviews/review-item";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildSuggestions, computeKpis, monthlyTrend, percentChange, ratingDistribution } from "@/lib/analytics";
import { DEMO_TODAY } from "@/lib/constants";
import { useAccessibleStores, useDemoState, useScopedReviews } from "@/lib/demo/store";
import { formatDate, formatNumber, formatRating } from "@/lib/format";
import { SuggestionList } from "./suggestion-list";
import { useOrgHref } from "@/components/layout/org-context";

export function DashboardView() {
  const reviews = useScopedReviews();
  const stores = useAccessibleStores();
  const selected = useDemoState((s) => s.selectedStoreId);
  const [openId, setOpenId] = useState<string | null>(null);
  const href = useOrgHref();

  const kpis = useMemo(() => computeKpis(reviews, DEMO_TODAY), [reviews]);
  const trend = useMemo(() => monthlyTrend(reviews, DEMO_TODAY, 12), [reviews]);
  const distribution = useMemo(() => ratingDistribution(reviews), [reviews]);
  const suggestions = useMemo(() => buildSuggestions(reviews, DEMO_TODAY), [reviews]);
  const latest = reviews.slice(0, 5);
  const storeById = new Map(stores.map((s) => [s.id, s]));
  const scopeLabel = selected === "all" ? `全店舗（${stores.length}店舗）` : storeById.get(selected)?.name;

  if (stores.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="まだ店舗が登録されていません"
        description="店舗設定から店舗を追加すると、ここに口コミの状況が表示されます。オーナー以外の方は、オーナーに担当店舗の設定を依頼してください。"
        action={
          <Button asChild>
            <Link href={href("/settings")}>店舗設定へ</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ダッシュボード"
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2">
            <span>{scopeLabel}</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {formatDate(DEMO_TODAY)} 時点
            </span>
          </span>
        }
        actions={
          <Button asChild variant="brand">
            <Link href={href("/reviews?status=unreplied")}>
              <Sparkles aria-hidden />
              未返信に対応する
            </Link>
          </Button>
        }
      />

      {kpis.pending > 0 || kpis.failed > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {kpis.pending > 0 ? (
            <Link
              href={href("/replies")}
              className="flex flex-1 items-center gap-3 rounded-xl border border-brand/20 bg-brand-soft px-4 py-3 text-sm text-primary hover:border-brand/40"
            >
              <Clock className="size-5 text-brand" aria-hidden />
              <span className="flex-1">
                承認待ちの返信案が <strong className="tabular">{kpis.pending}件</strong> あります
              </span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
          {kpis.failed > 0 ? (
            <Link
              href={href("/replies?tab=history")}
              className="flex flex-1 items-center gap-3 rounded-xl border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive hover:border-destructive/40"
            >
              <TriangleAlert className="size-5" aria-hidden />
              <span className="flex-1">
                Googleへの投稿に失敗した返信が <strong className="tabular">{kpis.failed}件</strong> あります
              </span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}

      <section aria-label="主要指標" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          title="総口コミ数"
          value={formatNumber(kpis.total)}
          unit="件"
          icon={MessageSquareText}
          footer={<span className="text-xs text-muted-foreground">今月 +{kpis.thisMonth}件</span>}
        />
        <KpiCard
          title="平均星評価"
          value={formatRating(kpis.average)}
          icon={Star}
          footer={
            <Delta
              label="今月"
              value={
                kpis.averageThisMonth !== null && kpis.averagePrevMonth !== null
                  ? kpis.averageThisMonth - kpis.averagePrevMonth
                  : null
              }
              unit=""
              digits={2}
            />
          }
        />
        <KpiCard
          title="今月の新規口コミ"
          value={formatNumber(kpis.thisMonth)}
          unit="件"
          icon={CalendarDays}
          footer={<Delta label="前月同期比" value={percentChange(kpis.thisMonth, kpis.prevMonthSamePeriod)} />}
        />
        <KpiCard
          title="未返信"
          value={formatNumber(kpis.unreplied)}
          unit="件"
          icon={Inbox}
          tone={kpis.unreplied > 0 ? "attention" : "default"}
          footer={
            <span className="text-xs text-muted-foreground">
              返信率 {kpis.replyRate === null ? "—" : `${kpis.replyRate.toFixed(0)}%`}
            </span>
          }
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>口コミ件数の推移</CardTitle>
            <CardDescription>直近12か月・月別（今月は途中経過）</CardDescription>
          </CardHeader>
          <CardContent>
            <ReviewCountChart data={trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>星評価の分布</CardTitle>
            <CardDescription>全期間 {formatNumber(kpis.total)}件</CardDescription>
          </CardHeader>
          <CardContent>
            <RatingDistribution data={distribution} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>平均評価の推移</CardTitle>
            <CardDescription>直近12か月・月別の平均星評価（今月は途中経過）</CardDescription>
          </CardHeader>
          <CardContent>
            <RatingTrendChart data={trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-1.5">
                <Sparkles className="size-4 text-brand" aria-hidden />
                AIからの改善提案
              </CardTitle>
              <CardDescription>直近90日の口コミから</CardDescription>
            </div>
            <Button asChild variant="link" size="sm" className="px-0">
              <Link href={href("/reports")}>
                詳しく見る
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <SuggestionList suggestions={suggestions.slice(0, 3)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle>最新の口コミ</CardTitle>
            <CardDescription>新しい順に5件</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={href("/reviews")}>
              すべて見る
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </CardHeader>
        {latest.length === 0 ? (
          <EmptyState icon={MessageSquareText} title="まだ口コミがありません" />
        ) : (
          <div>
            {latest.map((review) => (
              <ReviewItem
                key={review.id}
                review={review}
                store={storeById.get(review.storeId)}
                showStore={selected === "all"}
                onOpen={setOpenId}
                compact
              />
            ))}
          </div>
        )}
      </Card>

      <ReplyEditorSheet reviewId={openId} onOpenChange={(open) => !open && setOpenId(null)} />
    </div>
  );
}
