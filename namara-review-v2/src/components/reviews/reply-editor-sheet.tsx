"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Info,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { StarRating } from "@/components/common/star-rating";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { checkReply, generateReply } from "@/lib/ai/reply-generator";
import { TONE_LABELS } from "@/lib/constants";
import { approveAndPublish, demoNow, dispatch, useCurrentMember, useDemoState } from "@/lib/demo/store";
import { formatDateTime } from "@/lib/format";
import { canOnStore } from "@/lib/permissions";
import type { Review, Tone } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TopicChips } from "./topic-chips";

const TONES: Tone[] = ["polite", "friendly", "casual"];

export function ReplyEditorSheet({ reviewId, onOpenChange }: { reviewId: string | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={reviewId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl">
        {reviewId ? <ReplyEditor key={reviewId} reviewId={reviewId} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function ReplyEditor({ reviewId }: { reviewId: string }) {
  const review = useDemoState((s) => s.reviews.find((r) => r.id === reviewId));
  const stores = useDemoState((s) => s.stores);
  const draft = useDemoState((s) => s.drafts[reviewId]);
  const allPublications = useDemoState((s) => s.publications);
  const me = useCurrentMember();
  const publications = useMemo(() => allPublications.filter((p) => p.reviewId === reviewId), [allPublications, reviewId]);
  const store = stores.find((s) => s.id === review?.storeId);

  const [text, setText] = useState(draft?.text ?? "");
  const [tone, setTone] = useState<Tone>(draft?.tone ?? store?.policy.tone ?? "friendly");
  const [variant, setVariant] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!review || !store) {
    return (
      <div className="p-6">
        <SheetTitle>口コミが見つかりません</SheetTitle>
      </div>
    );
  }

  const canEdit = canOnStore(me, "reply.edit", store);
  const canSubmit = canOnStore(me, "reply.submit", store);
  const canApprove = canOnStore(me, "reply.approve", store);
  const locked = review.status === "published" || review.status === "publishing";
  const dirty = text !== (draft?.text ?? "") || (draft !== undefined && tone !== draft.tone);
  const checks = checkReply(text, store.policy, review.author);
  const hasError = checks.some((c) => c.level === "error");
  const lastFailure = publications.find((p) => p.status === "failed");

  async function generate(nextTone: Tone, nextVariant: number) {
    if (!review || !store) return;
    setGenerating(true);
    // Phase 4 で OpenAI API 呼び出し（サーバー側 Route Handler）に置き換える
    await new Promise((resolve) => setTimeout(resolve, 700));
    const generated = generateReply({ review, store, policy: store.policy, tone: nextTone, variant: nextVariant });
    setText(generated);
    setTone(nextTone);
    setVariant(nextVariant);
    dispatch({ type: "saveDraft", reviewId: review.id, text: generated, tone: nextTone, source: "ai", at: demoNow() });
    setGenerating(false);
  }

  function saveIfDirty() {
    if (!review) return;
    if (dirty || !draft) {
      dispatch({ type: "saveDraft", reviewId: review.id, text, tone, source: "edited", at: demoNow() });
    }
  }

  function handleSave() {
    saveIfDirty();
    toast.success("下書きを保存しました");
  }

  function handleSubmit() {
    if (!review) return;
    saveIfDirty();
    const ok = dispatch({ type: "submitForApproval", reviewId: review.id, at: demoNow() });
    if (ok) toast.success("承認依頼を送りました", { description: "オーナー・店長のLINEに通知されます（Phase 5で実装）" });
  }

  async function handlePublish() {
    if (!review) return;
    setConfirmOpen(false);
    saveIfDirty();
    const result = await approveAndPublish(review.id);
    if (result.ok) toast.success(result.message, { description: "投稿結果はLINEにも通知されます（Phase 5で実装）" });
    else toast.error("投稿に失敗しました", { description: result.message });
  }

  return (
    <>
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={review.status} />
          <span className="text-xs text-muted-foreground">{store.name}</span>
        </div>
        <SheetTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StarRating rating={review.rating} size="md" />
          <span>{review.author}</span>
        </SheetTitle>
        <SheetDescription>{formatDateTime(review.createdAt)} にGoogleへ投稿</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <section aria-labelledby="review-body" className="space-y-3">
          <h3 id="review-body" className="sr-only">
            口コミ本文
          </h3>
          <p className="whitespace-pre-line rounded-lg bg-muted/70 p-4 text-sm leading-relaxed">
            {review.text || "（評価のみの投稿・本文なし）"}
          </p>
          <TopicChips topics={review.topics} />
        </section>

        {review.publishedReply ? (
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              Googleに公開済みの返信
            </h3>
            <p className="whitespace-pre-line rounded-lg border border-success/20 bg-success-soft/50 p-4 text-sm leading-relaxed">
              {review.publishedReply.text}
            </p>
            <p className="text-xs text-muted-foreground">{formatDateTime(review.publishedReply.publishedAt)} に投稿</p>
          </section>
        ) : null}

        {!locked ? (
          <section className="space-y-4" aria-labelledby="reply-editor">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="reply-editor" className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="size-4 text-brand" aria-hidden />
                返信案
              </h3>
              {draft ? (
                <span className="text-xs text-muted-foreground">
                  最終更新 {formatDateTime(draft.updatedAt)}・{draft.updatedBy}
                </span>
              ) : null}
            </div>

            {review.status === "failed" && lastFailure ? (
              <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">前回の投稿に失敗しました（{formatDateTime(lastFailure.attemptedAt)}）</p>
                  <p className="mt-0.5 text-destructive/90">{lastFailure.error}</p>
                </div>
              </div>
            ) : null}

            {draft?.submittedAt && review.status === "pending" ? (
              <p className="flex items-center gap-1.5 rounded-lg bg-brand-soft px-3 py-2 text-sm text-primary">
                <Info className="size-4 text-brand" aria-hidden />
                {draft.submittedBy}さんが {formatDateTime(draft.submittedAt)} に承認依頼しました
              </p>
            ) : null}

            <fieldset className="space-y-2" disabled={!canEdit || generating}>
              <legend className="text-xs font-medium text-muted-foreground">返信のトーン</legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={tone === t}
                    onClick={() => (text ? generate(t, variant) : setTone(t))}
                    className={cn(
                      "cursor-pointer rounded-lg border px-2 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
                      tone === t ? "border-brand bg-brand-soft text-brand" : "hover:bg-muted",
                    )}
                  >
                    {TONE_LABELS[t]}
                  </button>
                ))}
              </div>
            </fieldset>

            {generating ? (
              <div className="space-y-2 rounded-md border p-3" aria-live="polite" aria-busy="true">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  AIが口コミの内容を読み取って返信案を作成しています…
                </p>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : text || draft ? (
              <div className="space-y-1.5">
                <Label htmlFor="reply-text" className="sr-only">
                  返信文
                </Label>
                <Textarea
                  id="reply-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={9}
                  maxLength={4096}
                  readOnly={!canEdit}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{dirty ? "未保存の変更があります" : draft ? "保存済み" : ""}</span>
                  <span className={cn("tabular", text.length > store.policy.maxLength && "text-warning")}>
                    {text.length} / 目安 {store.policy.maxLength}文字
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  店舗の返信方針（{TONE_LABELS[store.policy.tone]}・署名「{store.policy.signature || "なし"}」）に沿って、AIが返信案を作成します。
                </p>
                <Button className="mt-4" variant="brand" onClick={() => generate(tone, 0)} disabled={!canEdit}>
                  <Sparkles aria-hidden />
                  AIで返信案を作成
                </Button>
              </div>
            )}

            {text && !generating ? (
              <ul className="space-y-1.5" aria-label="返信文のチェック結果">
                {checks.length === 0 ? (
                  <li className="flex items-center gap-1.5 text-xs text-success">
                    <ShieldCheck className="size-3.5" aria-hidden />
                    NGワード・補償の約束・個人情報のチェックで問題は見つかりませんでした
                  </li>
                ) : (
                  checks.map((c) => (
                    <li
                      key={c.message}
                      className={cn("flex items-start gap-1.5 text-xs", c.level === "error" ? "text-destructive" : "text-warning")}
                    >
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {c.message}
                    </li>
                  ))
                )}
              </ul>
            ) : null}

            {!canEdit ? (
              <p className="text-xs text-muted-foreground">この店舗の返信を編集する権限がありません。</p>
            ) : !canApprove ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="size-3.5" aria-hidden />
                スタッフ権限では承認依頼までできます。Googleへの投稿はオーナー・店長が承認して行います。
              </p>
            ) : null}
          </section>
        ) : null}

        {publications.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">投稿履歴</h3>
            <ol className="space-y-2">
              {publications.map((p) => (
                <li key={p.id} className="flex items-start gap-2 text-xs">
                  {p.status === "success" ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
                  )}
                  <span>
                    {formatDateTime(p.attemptedAt)}・{p.actor}・{p.attempt}回目・{p.status === "success" ? "投稿成功" : "投稿失敗"}
                    {p.error ? <span className="block text-muted-foreground">{p.error}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      {!locked && canEdit && (text || draft) && !generating ? (
        <footer className="space-y-2 border-t bg-card p-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => generate(tone, variant + 1)}>
              <RefreshCw aria-hidden />
              再生成
            </Button>
            {dirty ? (
              <Button variant="outline" size="sm" onClick={handleSave} disabled={!text.trim()}>
                下書き保存
              </Button>
            ) : null}
            {draft ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  dispatch({ type: "discardDraft", reviewId: review.id, at: demoNow() });
                  setText("");
                  toast("返信案を破棄しました");
                }}
              >
                <Trash2 aria-hidden />
                破棄
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {review.status === "pending" && canApprove ? (
              <Button
                variant="outline"
                onClick={() => {
                  dispatch({ type: "sendBack", reviewId: review.id, at: demoNow() });
                  toast("下書きに差し戻しました");
                }}
              >
                <Undo2 aria-hidden />
                差し戻す
              </Button>
            ) : null}
            {canSubmit && !canApprove && review.status !== "pending" ? (
              <Button onClick={handleSubmit} disabled={hasError}>
                <Send aria-hidden />
                承認を依頼する
              </Button>
            ) : null}
            {canApprove ? (
              <Button variant="brand" onClick={() => setConfirmOpen(true)} disabled={hasError}>
                {review.status === "failed" ? <RefreshCw aria-hidden /> : <CheckCircle2 aria-hidden />}
                {review.status === "failed" ? "再試行して投稿" : "承認してGoogleに投稿"}
              </Button>
            ) : null}
          </div>
        </footer>
      ) : null}

      <PublishConfirm
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        review={review}
        text={text}
        onConfirm={handlePublish}
      />
    </>
  );
}

function PublishConfirm({
  open,
  onOpenChange,
  review,
  text,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: Review;
  text: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>この返信をGoogleに投稿しますか？</DialogTitle>
          <DialogDescription>
            投稿すると、Googleマップ上で誰でも閲覧できるようになります。内容をもう一度ご確認ください。
          </DialogDescription>
        </DialogHeader>
        <p className="max-h-60 overflow-y-auto whitespace-pre-line rounded-lg bg-muted p-3 text-sm">{text}</p>
        <p className="text-xs text-muted-foreground">
          対象：{review.author} さんの★{review.rating}の口コミ。デモでは実際には投稿されません。
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">戻って編集</Button>
          </DialogClose>
          <Button variant="brand" onClick={onConfirm}>
            <CheckCircle2 aria-hidden />
            承認して投稿
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
