"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, History, Inbox, Loader2, PenLine, RotateCcw, Settings2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { DemoNotice } from "@/components/common/demo-notice";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StarRating } from "@/components/common/star-rating";
import { ReplyEditorSheet } from "@/components/reviews/reply-editor-sheet";
import { PolicyForm } from "@/components/settings/policy-form";
import { StoreScopeSelect } from "@/components/settings/store-scope-select";
import { useStoreScope } from "@/components/settings/use-store-scope";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateReply } from "@/lib/ai/reply-generator";
import { demoNow, dispatch, getState, useAccessibleStores, useCurrentMember, useDemoState, useScopedReviews } from "@/lib/demo/store";
import { formatDateTime, formatRelative } from "@/lib/format";
import { canOnStore } from "@/lib/permissions";
import type { Review, Store } from "@/lib/types";
import { LinePreview } from "./line-preview";

const TABS = ["pending", "drafts", "history", "rules"] as const;
type TabValue = (typeof TABS)[number];

function DraftCard({
  review,
  store,
  text,
  meta,
  action,
}: {
  review: Review;
  store?: Store;
  text: string;
  meta: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StarRating rating={review.rating} />
        <span className="text-sm font-semibold">{review.author}</span>
        {store ? <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">{store.shortName}</span> : null}
        <span className="text-xs text-muted-foreground">{formatRelative(review.createdAt)}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{review.text || "（評価のみの投稿）"}</p>
      <div className="mt-3 rounded-lg border-l-4 border-brand bg-brand-soft/50 p-3">
        <p className="mb-1 flex items-center gap-1 text-xs font-medium text-brand">
          <Sparkles className="size-3.5" aria-hidden />
          返信案
        </p>
        <p className="line-clamp-4 whitespace-pre-line text-sm">{text}</p>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{meta}</p>
        {action}
      </div>
    </Card>
  );
}

export function RepliesView() {
  const searchParams = useSearchParams();
  const initialTab = TABS.find((t) => t === searchParams.get("tab")) ?? "pending";
  const [tab, setTab] = useState<TabValue>(initialTab);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);

  const reviews = useScopedReviews();
  const stores = useAccessibleStores();
  const drafts = useDemoState((s) => s.drafts);
  const publications = useDemoState((s) => s.publications);
  const me = useCurrentMember();
  const scope = useStoreScope();
  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);

  const pending = reviews.filter((r) => r.status === "pending");
  const draftList = reviews.filter((r) => r.status === "draft");
  const unreplied = reviews.filter((r) => r.status === "unreplied");
  const failed = reviews.filter((r) => r.status === "failed");
  const reviewIds = useMemo(() => new Set(reviews.map((r) => r.id)), [reviews]);
  const history = useMemo(
    () => publications.filter((p) => reviewIds.has(p.reviewId)).sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt)).slice(0, 50),
    [publications, reviewIds],
  );
  const reviewById = useMemo(() => new Map(reviews.map((r) => [r.id, r])), [reviews]);
  const linePreviewTarget = pending[0] ?? unreplied[0];

  async function generateAll() {
    setBulkRunning(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    let created = 0;
    const { stores: allStores } = getState();
    for (const review of unreplied) {
      const store = allStores.find((s) => s.id === review.storeId);
      if (!store || !canOnStore(me, "reply.edit", store)) continue;
      const text = generateReply({ review, store, policy: store.policy, tone: store.policy.tone, variant: created });
      if (dispatch({ type: "saveDraft", reviewId: review.id, text, tone: store.policy.tone, source: "ai", at: demoNow() })) created++;
    }
    setBulkRunning(false);
    toast.success(`${created}件の返信案を作成しました`, { description: "内容を確認して、承認または承認依頼をしてください" });
    setTab("drafts");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI返信管理"
        description="AIが作成した返信案を確認・編集し、承認してGoogleに投稿します。AIが無断で投稿することはありません。"
        actions={
          unreplied.length > 0 ? (
            <Button variant="brand" onClick={generateAll} disabled={bulkRunning}>
              {bulkRunning ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              未返信{unreplied.length}件の返信案をまとめて作成
            </Button>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="pending">
            <Clock aria-hidden />
            承認待ち
            <Badge variant={pending.length ? "brand" : "secondary"} className="ml-0.5 px-1.5">
              {pending.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="drafts">
            <PenLine aria-hidden />
            下書き
            <Badge variant="secondary" className="ml-0.5 px-1.5">
              {draftList.length + failed.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="history">
            <History aria-hidden />
            投稿履歴
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Settings2 aria-hidden />
            返信ルール
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-3">
              {pending.length === 0 ? (
                <Card>
                  <EmptyState icon={CheckCircle2} title="承認待ちの返信案はありません" description="スタッフが承認依頼をすると、ここに表示されます。" />
                </Card>
              ) : (
                pending.map((review) => (
                  <DraftCard
                    key={review.id}
                    review={review}
                    store={storeById.get(review.storeId)}
                    text={drafts[review.id]?.text ?? ""}
                    meta={
                      drafts[review.id]?.submittedAt
                        ? `${drafts[review.id]?.submittedBy}さんが${formatRelative(drafts[review.id]!.submittedAt!)}に承認依頼`
                        : "承認待ち"
                    }
                    action={
                      <Button size="sm" variant="brand" onClick={() => setOpenId(review.id)}>
                        確認して承認
                      </Button>
                    }
                  />
                ))
              )}
            </div>
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-sm">LINEではこう届きます</CardTitle>
                <CardDescription>新着口コミとAI返信案をLINEで受け取り、ボタンから承認ページを開けます。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {linePreviewTarget && storeById.get(linePreviewTarget.storeId) ? (
                  <LinePreview
                    review={linePreviewTarget}
                    store={storeById.get(linePreviewTarget.storeId)!}
                    draftText={drafts[linePreviewTarget.id]?.text}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">表示できる口コミがありません。</p>
                )}
                <DemoNotice>LINE通知は Phase 5 で実装します。現在は見え方のプレビューです。</DemoNotice>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="drafts" className="space-y-3">
          {failed.map((review) => (
            <DraftCard
              key={review.id}
              review={review}
              store={storeById.get(review.storeId)}
              text={drafts[review.id]?.text ?? ""}
              meta={
                <span className="inline-flex items-center gap-1 text-destructive">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  Googleへの投稿に失敗しました
                </span>
              }
              action={
                <Button size="sm" variant="destructive" onClick={() => setOpenId(review.id)}>
                  <RotateCcw aria-hidden />
                  確認して再試行
                </Button>
              }
            />
          ))}
          {draftList.map((review) => (
            <DraftCard
              key={review.id}
              review={review}
              store={storeById.get(review.storeId)}
              text={drafts[review.id]?.text ?? ""}
              meta={drafts[review.id] ? `${drafts[review.id].updatedBy}・${formatRelative(drafts[review.id].updatedAt)}` : ""}
              action={
                <Button size="sm" variant="outline" onClick={() => setOpenId(review.id)}>
                  <PenLine aria-hidden />
                  確認・編集
                </Button>
              }
            />
          ))}
          {draftList.length + failed.length === 0 ? (
            <Card>
              <EmptyState
                icon={Inbox}
                title="下書きはありません"
                description={unreplied.length > 0 ? `未返信の口コミが${unreplied.length}件あります。右上のボタンで返信案をまとめて作成できます。` : "すべての口コミに対応済みです。"}
              />
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>投稿履歴</CardTitle>
              <CardDescription>
                同じ返信は「口コミID＋返信案の版数」の冪等キーで管理し、二重に投稿されないようにしています。直近50件を表示。
              </CardDescription>
            </CardHeader>
            {history.length === 0 ? (
              <EmptyState icon={History} title="投稿履歴はまだありません" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日時</TableHead>
                    <TableHead>結果</TableHead>
                    <TableHead>店舗</TableHead>
                    <TableHead>口コミ</TableHead>
                    <TableHead>実行者</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((p) => {
                    const review = reviewById.get(p.reviewId);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs tabular">{formatDateTime(p.attemptedAt)}</TableCell>
                        <TableCell>
                          {p.status === "success" ? (
                            <Badge variant="success">
                              <CheckCircle2 aria-hidden />
                              成功
                            </Badge>
                          ) : (
                            <Badge variant="destructive" title={p.error ?? undefined}>
                              <AlertTriangle aria-hidden />
                              失敗（{p.attempt}回目）
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{storeById.get(review?.storeId ?? "")?.shortName}</TableCell>
                        <TableCell className="max-w-64 truncate text-xs">
                          {review ? `★${review.rating} ${review.author}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{p.actor}</TableCell>
                        <TableCell className="text-right">
                          {review?.status === "failed" && p.status === "failed" ? (
                            <Button size="sm" variant="outline" onClick={() => setOpenId(review.id)}>
                              <RotateCcw aria-hidden />
                              再試行
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => review && setOpenId(review.id)}>
                              詳細
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          {scope.showPicker && scope.store ? (
            <StoreScopeSelect stores={scope.stores} value={scope.store.id} onChange={scope.setPicked} />
          ) : null}
          {scope.store ? <PolicyForm key={scope.store.id} store={scope.store} /> : null}
        </TabsContent>
      </Tabs>

      <ReplyEditorSheet reviewId={openId} onOpenChange={(open) => !open && setOpenId(null)} />
    </div>
  );
}
