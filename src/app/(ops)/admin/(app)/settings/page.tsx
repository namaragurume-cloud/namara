import { SubmitButton } from "@/components/ops/client";
import { Badge, Card, Flash } from "@/components/ops/ui";
import { dbMode } from "@/lib/ops/db";
import { isEmailConfigured } from "@/lib/ops/email";
import { isLineConfigured, lineBasicId } from "@/lib/ops/line";
import { isAiConfigured } from "@/lib/ops/vision";
import { absoluteUrl } from "@/lib/utils";
import { runDailyNow } from "../../actions";

export const metadata = { title: "設定" };

function Row({ ok, title, children }: { ok: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="py-3">
      <div className="flex items-center gap-2">
        {ok ? <Badge tone="green">設定済み</Badge> : <Badge tone="amber">未設定</Badge>}
        <b>{title}</b>
      </div>
      <div className="mt-1 text-sm leading-relaxed text-muted">{children}</div>
    </li>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ flash?: string }> }) {
  const { flash } = await searchParams;
  const mode = dbMode();
  return (
    <>
      <Flash text={flash} />
      <h1 className="text-xl font-extrabold md:text-2xl">設定</h1>
      <Card title="連携の状態">
        <ul className="divide-y divide-line">
          <Row ok={mode === "redis"} title="データの保存先（Upstash Redis）">
            {mode === "file" ? "開発用：このパソコンの .data/ops.json に保存しています。" : "Vercel の Storage から Upstash Redis を追加してプロジェクトに接続してください。"}
          </Row>
          <Row ok={isLineConfigured()} title="公式LINE（Messaging API）">
            発信者への自動送信に使います。<code>LINE_CHANNEL_ACCESS_TOKEN</code>・<code>LINE_CHANNEL_SECRET</code>・<code>LINE_BOT_BASIC_ID</code>
            {lineBasicId() ? `（${lineBasicId()}）` : ""} を設定し、LINE Developers で Webhook URL を <code className="break-all">{absoluteUrl("/api/line/webhook")}</code> にして「Webhookの利用」をオンにしてください。
          </Row>
          <Row ok={isEmailConfigured()} title="メール送信（Resend）">
            LINE未連携の発信者と、飲食店への送付に使います。サイトのフォームと同じ <code>RESEND_API_KEY</code>・<code>MAIL_FROM</code> を使います。
          </Row>
          <Row ok={isAiConfigured()} title="スクショの自動読み取り（Claude API）">
            インサイトのスクショから数値を読み取り、足りない項目を判定します。レポート文章の下書きにも使います。<code>ANTHROPIC_API_KEY</code> を設定してください（
            <a href="https://console.anthropic.com" target="_blank" rel="noopener" className="underline">
              console.anthropic.com
            </a>
            で発行。1投稿の読み取りあたり数円程度）。未設定でもスクショの受け取りはでき、数値は管理画面で手入力できます。
          </Row>
          <Row ok={Boolean(process.env.CRON_SECRET)} title="毎日の自動処理">
            毎日10時ごろにリマインド、月末{process.env.OPS_INSIGHT_DAY && process.env.OPS_INSIGHT_DAY !== "last" ? `（設定：毎月${process.env.OPS_INSIGHT_DAY}日）` : ""}にインサイト提出のお願いを自動送信します。Vercel に <code>CRON_SECRET</code>（ランダムな文字列）を設定してください。
          </Row>
        </ul>
      </Card>
      <Card title="自動処理を今すぐ実行">
        <p className="text-sm text-muted">毎日の自動処理（リマインド・月末ならインサイト依頼）を今すぐ1回実行します。送信済みの人には重ねて送りません。</p>
        <form action={runDailyNow} className="mt-3">
          <SubmitButton variant="outline">今すぐ実行</SubmitButton>
        </form>
      </Card>
    </>
  );
}
