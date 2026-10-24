import type { Metadata } from "next";
import { sendDigestAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/admin/ActionButton";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { Badge } from "@/components/ui/Badge";
import { dateTime } from "@/lib/format";
import { env } from "@/server/env";
import { DIGEST_COOLDOWN_HOURS, listNotifications, previewEveningDigest } from "@/server/services/notifications";

export const metadata: Metadata = { title: "通知" };

export default async function AdminNotificationsPage() {
  const [preview, history] = await Promise.all([previewEveningDigest(), listNotifications()]);
  const lineTargets = preview.targets.filter((t) => t.lineUserId).length;
  const live = env.line.digestSendEnabled;
  return (
    <div className="space-y-6">
      <PageHeader
        title="通知"
        sub={`商品ごとに全員へは送らず、1日1回のまとめ通知だけを送ります（1人あたり${DIGEST_COOLDOWN_HOURS}時間に1通まで）。`}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">今夜のTABETUNAGU（プレビュー）</h2>
            <Badge tone={live ? "green" : "sand"}>{live ? "LINE 送信可" : "dry run"}</Badge>
          </div>
          <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-[#e7f1e3] p-4 font-sans text-[13.5px] leading-relaxed">{preview.sample}</pre>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-[12px]">
            <div className="rounded-xl bg-canvas p-2.5">
              <dt className="text-muted">受付中の商品</dt>
              <dd className="tnum text-[18px] font-semibold">{preview.total}</dd>
            </div>
            <div className="rounded-xl bg-canvas p-2.5">
              <dt className="text-muted">通知対象</dt>
              <dd className="tnum text-[18px] font-semibold">{preview.targets.length}</dd>
            </div>
            <div className="rounded-xl bg-canvas p-2.5">
              <dt className="text-muted">うちLINE連携</dt>
              <dd className="tnum text-[18px] font-semibold">{lineTargets}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[12px] text-muted">
            通知エリアを登録しているユーザーにはそのエリアの件数だけを、STANDARD 店舗をお気に入りにしているユーザーにはその店舗名も添えます。
            {!live && " LINE_CHANNEL_ACCESS_TOKEN が未設定のため、送信はせず対象者の記録だけを行います。"}
          </p>
          <div className="mt-4">
            <ActionButton action={sendDigestAction} label={live ? "いま送信する" : "通知対象を作成する（dry run）"} variant="dark" confirm="まとめ通知を作成します。よろしいですか？" />
          </div>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-[15px] font-bold">履歴</h2>
          {history.length === 0 ? (
            <p className="text-[13px] text-muted">まだ通知はありません。</p>
          ) : (
            <ul className="divide-y divide-line text-[13px]">
              {history.map((n) => (
                <li key={n.id} className="flex items-center justify-between py-2.5">
                  <span>
                    <span className="block font-semibold">{n.title}</span>
                    <span className="tnum block text-[12px] text-muted">{dateTime(n.created_at)}</span>
                  </span>
                  <span className="text-right">
                    <Badge tone={n.status === "sent" ? "green" : n.status === "failed" ? "clay" : "sand"}>{n.status}</Badge>
                    <span className="tnum block text-[12px] text-muted">
                      {n.sent_count} / {n.target_count}人
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
