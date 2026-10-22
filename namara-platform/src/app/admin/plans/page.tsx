import type { Metadata } from "next";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { AccessDenied } from "@/components/layout/AppShell";
import { Badge, Card, Notice, PageHeader, fmt } from "@/components/ui/primitives";
import { PLANS } from "@/lib/data/plans";
import { resolveAdminContext } from "@/lib/server/admin-context";

export const metadata: Metadata = { title: "料金プラン・連携状況｜運営" };

/** 外部サービスの接続状況（値そのものは表示しない。設定の有無だけ） */
function integrations() {
  const has = (k: string) => Boolean(process.env[k]);
  return [
    { name: "Supabase（DB・認証）", status: has("NEXT_PUBLIC_SUPABASE_URL") && has("SUPABASE_SERVICE_ROLE_KEY") ? "設定あり（未使用）" : "未接続（インメモリのモック）" },
    { name: "LINE Messaging API（なまらAI）", status: has("LINE_CHANNEL_SECRET") ? (process.env.LINE_REPLY_ENABLED === "1" ? "返信有効" : "署名検証のみ（返信はモック）") : "未接続" },
    { name: "LINE（店舗通知チャネル）", status: has("LINE_STORE_NOTIFY_CHANNEL_SECRET") ? "設定あり（未使用）" : "未接続（Phase 9）" },
    { name: "OpenAI API", status: has("OPENAI_API_KEY") ? "設定あり（未使用）" : "未接続（辞書ベースの解析を使用）" },
    { name: "Google Business Profile API", status: "未接続（利用申請・承認後に Phase 8）" },
    { name: "Google Places API", status: "未採用（利用条件の確認待ち）" },
  ];
}

export default async function AdminPlansPage() {
  const ctx = await resolveAdminContext();
  if (!ctx.ok) return <AccessDenied message={ctx.reason} />;

  return (
    <AdminFrame active="plans" accountLabel={ctx.accountLabel}>
      <PageHeader title="料金プラン・外部連携状況" description="料金はすべて仮設定です。" />
      <Notice tone="warn">課金・決済は未実装です（Phase 10）。価格・機能制限・利用枠は将来 plans テーブルで管理し、この画面から変更できるようにします。</Notice>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p.id} title={p.name} action={<Badge tone="muted">仮設定</Badge>}>
            <p className="text-2xl font-bold tabular-nums">
              {fmt(p.priceYen)}円<span className="text-sm font-medium text-muted">/{p.unit}{p.from ? "〜" : ""}</span>
            </p>
            <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-muted">
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              店舗数上限：{p.limits.stores ?? "—"}／AI返信案：{p.limits.aiReplyDrafts === null ? "無制限" : `${p.limits.aiReplyDrafts}件/月`}
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card title="外部連携の状況" description="APIキーの値は表示しません">
          <ul className="divide-y divide-line text-sm">
            {integrations().map((i) => (
              <li key={i.name} className="flex justify-between gap-3 py-2">
                <span>{i.name}</span>
                <span className="text-right text-muted">{i.status}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="API使用量・AI処理コスト">
          <p className="text-sm text-muted">外部APIを使っていないため、現在の使用量・コストは0円です。OpenAI 接続後は検索1回ごとのトークン数と推定コストを記録して表示します（推定値と請求実績は区別して表示）。</p>
        </Card>
      </div>
    </AdminFrame>
  );
}
