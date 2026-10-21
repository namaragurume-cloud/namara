"use client";

import { Bot, Link2, MapPin, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { DemoNotice } from "@/components/common/demo-notice";
import { IntegrationBadge } from "@/components/common/integration-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { dispatch, useDemoState } from "@/lib/demo/store";
import { formatDateTime } from "@/lib/format";
import type { Store } from "@/lib/types";

export function IntegrationsPanel({ store }: { store: Store }) {
  const members = useDemoState((s) => s.members);
  const simulateFailure = useDemoState((s) => s.simulateFailure);
  const lineLinked = members.filter((m) => m.lineLinked && (m.role === "owner" || m.storeIds.includes(store.id)));

  return (
    <div className="space-y-4">
      <DemoNotice>
        Phase 1 では外部サービスに接続していません。表示されている連携状態はサンプルです。Google連携は Phase 3、OpenAI は
        Phase 4、LINE は Phase 5 で、ご確認をいただいてから実装します。
      </DemoNotice>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <MapPin className="size-5" aria-hidden />
              </span>
              <IntegrationBadge status={store.googleStatus} />
            </div>
            <CardTitle className="mt-2">Googleビジネスプロフィール</CardTitle>
            <CardDescription>口コミの取得と、承認した返信の投稿に使います。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">ロケーション</dt>
                <dd className="truncate">{store.googleLocationName ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">最終同期</dt>
                <dd>{store.googleLastSyncedAt ? formatDateTime(store.googleLastSyncedAt) : "—"}</dd>
              </div>
            </dl>
            {store.googleStatus === "error" ? (
              <p className="rounded-md bg-destructive-soft p-2 text-xs text-destructive">
                認証の有効期限が切れています。再接続するまで口コミの同期と返信の投稿ができません。
              </p>
            ) : null}
            <Button variant="outline" className="w-full" disabled title="Phase 3 で実装">
              <Link2 aria-hidden />
              {store.googleStatus === "not_connected" ? "Googleと接続" : "再接続"}（Phase 3）
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-lg bg-success-soft text-success">
                <MessageCircle className="size-5" aria-hidden />
              </span>
              <IntegrationBadge status={store.lineStatus} />
            </div>
            <CardTitle className="mt-2">LINE通知</CardTitle>
            <CardDescription>新着口コミ・返信案・投稿結果を担当者のLINEに届けます。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              LINE連携済みの担当者：{lineLinked.length > 0 ? lineLinked.map((m) => m.name).join("、") : "なし"}
            </p>
            <Button variant="outline" className="w-full" disabled title="Phase 5 で実装">
              <Link2 aria-hidden />
              LINEと連携（Phase 5）
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
                <Bot className="size-5" aria-hidden />
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">デモ（テンプレート）</span>
            </div>
            <CardTitle className="mt-2">AI返信（OpenAI）</CardTitle>
            <CardDescription>口コミの内容に合わせた返信案を作成します。</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            現在はテンプレートによる返信案です。Phase 4 でOpenAI APIに接続します（APIキーはサーバー側でのみ保持）。
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-base">
            <RefreshCw className="size-4 text-brand" aria-hidden />
            エラー処理の確認（デモ専用）
          </CardTitle>
          <CardDescription>オンにすると、Googleへの返信投稿が必ず失敗します。失敗表示と再試行の流れを確認できます。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              id="simulate-failure"
              checked={simulateFailure}
              onCheckedChange={(value) => {
                dispatch({ type: "setSimulateFailure", value });
                toast(value ? "投稿失敗のシミュレーションをオンにしました" : "投稿失敗のシミュレーションをオフにしました");
              }}
            />
            <Label htmlFor="simulate-failure">投稿失敗をシミュレートする</Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
