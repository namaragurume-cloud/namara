import { SubmitButton } from "@/components/ops/client";
import { Badge, ButtonLink, Card, Field, Flash, inputClass } from "@/components/ops/ui";
import { dbMode } from "@/lib/ops/db";
import { isEmailConfigured } from "@/lib/ops/email";
import { isLineConfigured, lineBasicId } from "@/lib/ops/line";
import { isAiConfigured } from "@/lib/ops/vision";
import { blobAccess, blobAuth, videoStorage } from "@/lib/ops/video-store";
import { absoluteUrl } from "@/lib/utils";
import { resetDemoAction, runDailyNow, saveProposalSettings } from "../../actions";
import { proposalSettings } from "@/lib/ops/proposal-store";

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
  const ps = await proposalSettings();
  return (
    <>
      <Flash text={flash} />
      <h1 className="text-xl font-extrabold md:text-2xl">設定</h1>
      <Card title="メッセージの文面">
        <p className="text-sm text-muted">発信者・飲食店に送るLINE・メールの文章を編集できます。保存するとすぐ反映されます。</p>
        <ButtonLink href="/admin/settings/messages" variant="outline" size="sm" className="mt-3">
          文面を編集する
        </ButtonLink>
      </Card>
      <Card title="飲食店への提案（料金の計算）">
        <form action={saveProposalSettings} className="grid gap-3 md:grid-cols-4">
          <Field label="消費税率（%）">
            <input name="taxRate" inputMode="numeric" defaultValue={ps.taxRate} className={inputClass} />
          </Field>
          <Field label="固定費の名前">
            <input name="directionFeeLabel" defaultValue={ps.directionFeeLabel} className={inputClass} />
          </Field>
          <Field label="固定費（税別・円）" hint="0なら料金表に載せません">
            <input name="directionFee" inputMode="numeric" defaultValue={ps.directionFee} className={inputClass} />
          </Field>
          <Field label="提案の有効期限（日）">
            <input name="validDays" inputMode="numeric" defaultValue={ps.validDays} className={inputClass} />
          </Field>
          <div className="md:col-span-4">
            <Field label="料金表の下に載せる備考">
              <textarea name="notes" rows={2} defaultValue={ps.notes} className={inputClass} />
            </Field>
          </div>
          <label className="flex items-start gap-2 text-sm md:col-span-4">
            <input type="checkbox" name="showReach" defaultChecked={ps.showReach !== false} className="mt-1 accent-[var(--brand)]" />
            <span>
              <b>料金表に予想リーチを載せる</b>
              <span className="block text-xs text-muted">集まったインサイト（Instagramは閲覧者、TikTokは総視聴数）から、発信者ごとの予想リーチを推計して載せます。推計であること・成果を保証しないことも料金表に明記します。</span>
            </span>
          </label>
          <div className="md:col-span-4">
            <SubmitButton variant="outline" size="sm">
              保存
            </SubmitButton>
            <span className="ml-3 text-xs text-muted">発信者ごとの料金は「発信者」の各ページで設定します。</span>
          </div>
        </form>
      </Card>
      <Card title="連携の状態">
        <ul className="divide-y divide-line">
          <Row ok={mode === "redis"} title="データの保存先（Upstash Redis）">
            {mode === "demo" ? "デモ：サンプルデータをメモリ上に保持しています（保存はされません）。" : mode === "file" ? "開発用：このパソコンの .data/ops.json に保存しています。" : "Vercel の Storage から Upstash Redis を追加してプロジェクトに接続してください。"}
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
          <Row ok={videoStorage() === "blob" || videoStorage() === "demo"} title="動画の保存先（Vercel Blob）">
            投稿前の動画チェックで、発信者が送る動画の保存に使います。Vercel の Storage から <b>Blob</b> を追加してプロジェクトに接続してください（<code>BLOB_STORE_ID</code> または <code>BLOB_READ_WRITE_TOKEN</code> が自動で入ります）。投稿が済んだ動画は自動で削除されます。
            {blobAuth() && `（接続方式：${blobAuth() === "oidc" ? "OIDC" : "トークン"}・動画の公開設定：${blobAccess() === "private" ? "非公開（表示のたびに期限付きURL）" : "公開URL"}）`}
          </Row>
          <Row ok={Boolean(process.env.CRON_SECRET)} title="毎日の自動処理">
            毎日10時ごろにリマインド、月末{process.env.OPS_INSIGHT_DAY && process.env.OPS_INSIGHT_DAY !== "last" ? `（設定：毎月${process.env.OPS_INSIGHT_DAY}日）` : ""}にインサイト提出のお願いを自動送信します。Vercel に <code>CRON_SECRET</code>（ランダムな文字列）を設定してください。
          </Row>
        </ul>
      </Card>
      {mode === "demo" && (
        <Card title="デモを最初の状態に戻す">
          <form action={resetDemoAction}>
            <SubmitButton variant="outline">サンプルデータに戻す</SubmitButton>
          </form>
        </Card>
      )}
      <Card title="自動処理を今すぐ実行">
        <p className="text-sm text-muted">毎日の自動処理（リマインド・月末ならインサイト依頼）を今すぐ1回実行します。送信済みの人には重ねて送りません。</p>
        <form action={runDailyNow} className="mt-3">
          <SubmitButton variant="outline">今すぐ実行</SubmitButton>
        </form>
      </Card>
    </>
  );
}
