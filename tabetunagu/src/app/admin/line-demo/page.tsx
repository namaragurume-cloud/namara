import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LineDemoForm } from "@/components/admin/LineDemoForm";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { Badge } from "@/components/ui/Badge";
import { dateTime } from "@/lib/format";
import { requireAdmin } from "@/server/auth/viewer";
import { env } from "@/server/env";
import { orderTemplateConfig, recentServiceMessageLogs } from "@/server/services/line-notifications";

export const metadata: Metadata = { title: "LINE 通知デモ" };

const STATUS: Record<string, string> = { sent: "送信済み", failed: "失敗", skipped: "送信せず" };

/**
 * LINE ミニアプリのサービスメッセージのデモ（管理者・開発／プレビュー環境のみ。本番では表示しない）。
 * 自分自身の LINE に「注文完了」を1件送る。販促（値下げ・新商品・クーポン・おすすめ）は送らない。
 */
export default async function LineDemoPage() {
  const viewer = await requireAdmin("/admin/line-demo");
  if (!env.line.serviceMessageDemoEnabled) notFound();
  const config = orderTemplateConfig();
  const logs = await recentServiceMessageLogs(viewer.id);
  return (
    <div className="max-w-2xl space-y-6" data-testid="line-demo">
      <PageHeader title="LINE 通知デモ（サービスメッセージ）" sub="ログイン中の自分の LINE に「注文完了」の通知を1件送ります。ほかのユーザーには送りません。" />
      <section className="card space-y-2 p-5 text-[13px]">
        <div className="flex items-center justify-between gap-2">
          <span>LINE でログインしたアカウント</span>
          <Badge tone={viewer.lineLinked ? "green" : "clay"}>{viewer.lineLinked ? "はい" : "いいえ（デモ用アカウント）"}</Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>注文完了のテンプレート</span>
          <Badge tone={config ? "green" : "clay"}>{config ? `設定済み（${config.templateName}）` : "未設定"}</Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>LINE ミニアプリのチャネル</span>
          <Badge tone={env.line.miniAppChannelId && env.line.miniAppChannelSecret ? "green" : "clay"}>
            {env.line.miniAppChannelId && env.line.miniAppChannelSecret ? "設定済み" : "未設定"}
          </Badge>
        </div>
        <p className="pt-1 text-[12px] text-muted">
          届いた通知は LINE アプリの「LINEミニアプリ お知らせ」のトークに表示されます。未認証の LINE ミニアプリでは、開発用の内部チャネルの
          Admin / Tester 権限のある開発者にだけ届きます。
        </p>
      </section>
      <section className="card p-5">
        <LineDemoForm />
      </section>
      <section>
        <h2 className="mb-2 text-[15px] font-bold">直近の送信記録</h2>
        {logs.length === 0 ? (
          <p className="text-[13px] text-muted">まだ送信していません。</p>
        ) : (
          <ul className="card divide-y divide-line text-[13px]" data-testid="line-demo-logs">
            {logs.map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <span className="tnum">{dateTime(l.created_at as unknown as string)}</span>
                <span>
                  {STATUS[l.status] ?? l.status}
                  {l.error_category && <span className="ml-1 text-muted">（{l.error_category}）</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
