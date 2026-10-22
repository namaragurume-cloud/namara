"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { DemoNotice } from "@/components/common/demo-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { demoNow, dispatch, useCurrentMember } from "@/lib/demo/store";
import { canOnStore } from "@/lib/permissions";
import type { NotificationSettings, Store } from "@/lib/types";

const TOGGLES: { key: Exclude<keyof NotificationSettings, "lowRatingThreshold">; label: string; description: string }[] = [
  { key: "lineNewReview", label: "新着口コミをLINEで通知", description: "Googleに新しい口コミが投稿されたら、AI返信案と一緒に通知します。" },
  { key: "lineLowRatingOnly", label: "低評価のときだけ通知", description: "下で設定した星の数以下の口コミだけを通知します。" },
  { key: "lineDraftReady", label: "承認依頼をLINEで通知", description: "スタッフが返信案の承認を依頼したら、オーナー・店長に通知します。" },
  { key: "linePublishResult", label: "投稿結果をLINEで通知", description: "Googleへの返信の投稿が完了・失敗したときに通知します。" },
  { key: "emailWeeklyReport", label: "週次レポートをメールで受け取る", description: "毎週月曜日に、先週の口コミのまとめをメールで送ります。" },
];

export function NotificationsForm({ store }: { store: Store }) {
  const me = useCurrentMember();
  const canEdit = canOnStore(me, "notifications.edit", store);
  const [settings, setSettings] = useState<NotificationSettings>(store.notifications);

  return (
    <Card>
      <CardHeader>
        <CardTitle>通知設定</CardTitle>
        <CardDescription>{store.name} の通知の受け取り方を設定します。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <DemoNotice>実際のLINE・メール送信は Phase 5 以降で実装します。設定内容はこのブラウザに保存されます。</DemoNotice>
        <ul className="divide-y rounded-lg border">
          {TOGGLES.map((t) => (
            <li key={t.key} className="flex items-start justify-between gap-4 p-4">
              <div>
                <Label htmlFor={`notify-${t.key}`}>{t.label}</Label>
                <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
              </div>
              <Switch
                id={`notify-${t.key}`}
                checked={settings[t.key]}
                disabled={!canEdit || (t.key === "lineLowRatingOnly" && !settings.lineNewReview)}
                onCheckedChange={(value) => setSettings((s) => ({ ...s, [t.key]: value }))}
              />
            </li>
          ))}
          <li className="flex items-center justify-between gap-4 p-4">
            <Label htmlFor="threshold">低評価とみなす星の数</Label>
            <Select
              value={String(settings.lowRatingThreshold)}
              onValueChange={(v) => setSettings((s) => ({ ...s, lowRatingThreshold: Number(v) as 1 | 2 | 3 }))}
              disabled={!canEdit}
            >
              <SelectTrigger id="threshold" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">★1のみ</SelectItem>
                <SelectItem value="2">★2以下</SelectItem>
                <SelectItem value="3">★3以下</SelectItem>
              </SelectContent>
            </Select>
          </li>
        </ul>
        <div className="flex items-center justify-between gap-3">
          {!canEdit ? <p className="text-xs text-muted-foreground">通知設定の編集はオーナー・店長のみ可能です。</p> : <span />}
          <Button
            disabled={!canEdit}
            onClick={() => {
              if (dispatch({ type: "updateNotifications", storeId: store.id, notifications: settings, at: demoNow() }))
                toast.success("通知設定を保存しました");
            }}
          >
            <Save aria-hidden />
            保存する
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
