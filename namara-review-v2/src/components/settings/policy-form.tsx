"use client";

import { useMemo, useState } from "react";
import { Eye, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { generateReply } from "@/lib/ai/reply-generator";
import { TONE_DESCRIPTIONS, TONE_LABELS } from "@/lib/constants";
import { demoNow, dispatch, useCurrentMember, useDemoState } from "@/lib/demo/store";
import { canOnStore } from "@/lib/permissions";
import type { ReplyPolicy, Store, Tone } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONES: Tone[] = ["polite", "friendly", "casual"];

function splitLines(value: string) {
  return value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
}

function splitWords(value: string) {
  return value
    .split(/[、,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/** 店舗ごとのAI返信方針。key に store.id を渡して店舗切替時にフォームを作り直す */
export function PolicyForm({ store }: { store: Store }) {
  const me = useCurrentMember();
  const reviews = useDemoState((s) => s.reviews);
  const canEdit = canOnStore(me, "policy.edit", store.id);

  const [tone, setTone] = useState<Tone>(store.policy.tone);
  const [signature, setSignature] = useState(store.policy.signature);
  const [rules, setRules] = useState(store.policy.rules.join("\n"));
  const [ngWords, setNgWords] = useState(store.policy.ngWords.join("、"));
  const [lowRatingGuidance, setLowRatingGuidance] = useState(store.policy.lowRatingGuidance);
  const [maxLength, setMaxLength] = useState(String(store.policy.maxLength));
  const [previewType, setPreviewType] = useState<"high" | "low">("high");

  const policy: ReplyPolicy = {
    tone,
    signature: signature.trim(),
    rules: splitLines(rules),
    ngWords: splitWords(ngWords),
    lowRatingGuidance: lowRatingGuidance.trim(),
    maxLength: Number(maxLength),
  };

  const sample = useMemo(
    () =>
      reviews.find(
        (r) => r.storeId === store.id && r.text && (previewType === "high" ? r.rating === 5 : r.rating <= 2),
      ),
    [reviews, store.id, previewType],
  );

  const preview = sample ? generateReply({ review: sample, store, policy, tone, variant: 0 }) : null;

  function save() {
    const ok = dispatch({ type: "updatePolicy", storeId: store.id, policy, at: demoNow() });
    if (ok) toast.success("AI返信方針を保存しました", { description: "次に作成する返信案から反映されます" });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
      <Card>
        <CardHeader>
          <CardTitle>AI返信方針</CardTitle>
          <CardDescription>{store.name} の返信案を作るときにAIが守るルールです。</CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset disabled={!canEdit} className="space-y-6">
            <div className="space-y-2">
              <legend className="text-sm font-medium">返信トーン</legend>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="返信トーン">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={tone === t}
                    onClick={() => setTone(t)}
                    className={cn(
                      "cursor-pointer rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed",
                      tone === t ? "border-brand bg-brand-soft" : "hover:bg-muted",
                    )}
                  >
                    <span className={cn("block text-sm font-semibold", tone === t && "text-brand")}>{TONE_LABELS[t]}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{TONE_DESCRIPTIONS[t]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <div className="space-y-2">
                <Label htmlFor="signature">署名</Label>
                <Input id="signature" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="例：店長 山田" maxLength={60} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-length">文字数の目安</Label>
                <Select value={maxLength} onValueChange={setMaxLength} disabled={!canEdit}>
                  <SelectTrigger id="max-length">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["150", "200", "260", "300", "320", "400"].map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}文字
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rules">店舗独自のルール（1行に1つ）</Label>
              <Textarea
                id="rules"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                rows={4}
                placeholder={"例：お子様連れの口コミには、キッズメニューへの感謝を添える\n例：「またのご来店をお待ちしております」で締める"}
              />
              <p className="text-xs text-muted-foreground">
                Phase 1 のテンプレート生成ではまだ反映されません。Phase 4 のOpenAI連携で、AIへの指示として使います。トーン・署名・低評価への追記文は現在も返信案に反映され、NGワードは承認前のチェックに使われます。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ng-words">NGワード（読点・カンマ区切り）</Label>
              <Input id="ng-words" value={ngWords} onChange={(e) => setNgWords(e.target.value)} placeholder="例：激安、最安値" />
              <p className="text-xs text-muted-foreground">NGワードを含む返信は承認できません。</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="low-rating">低評価（★1〜2）への追記文</Label>
              <Textarea
                id="low-rating"
                value={lowRatingGuidance}
                onChange={(e) => setLowRatingGuidance(e.target.value)}
                rows={2}
                placeholder="例：お手数ですが、詳しい状況を店舗までお聞かせいただけますと幸いです。"
              />
              <p className="text-xs text-muted-foreground">
                返金・無料などの補償の約束は書かないでください。AIも補償や断定的な改善の約束はしません。
              </p>
            </div>
          </fieldset>
          <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
            {!canEdit ? (
              <p className="text-xs text-muted-foreground">返信方針の編集はオーナー・店長のみ可能です。</p>
            ) : (
              <span />
            )}
            <Button onClick={save} disabled={!canEdit}>
              <Save aria-hidden />
              保存する
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit xl:sticky xl:top-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Eye className="size-4 text-brand" aria-hidden />
            返信プレビュー
          </CardTitle>
          <CardDescription>保存前の設定で、実際の口コミへの返信例を表示します。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1" role="radiogroup" aria-label="プレビューする口コミ">
            {(
              [
                ["high", "高評価への返信"],
                ["low", "低評価への返信"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={previewType === value}
                onClick={() => setPreviewType(value)}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium",
                  previewType === value ? "bg-card shadow-sm" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {sample && preview ? (
            <>
              <p className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                ★{sample.rating}「{sample.text}」
              </p>
              <p className="whitespace-pre-line rounded-lg border p-3 text-sm leading-relaxed">{preview}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">プレビューに使える口コミがありません。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
