import type { Metadata } from "next";
import { sendDigestAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/admin/ActionButton";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { Badge } from "@/components/ui/Badge";
import { dateTime } from "@/lib/format";
import { DIGEST_COOLDOWN_HOURS, listNotifications, previewEveningDigest } from "@/server/services/notifications";

export const metadata: Metadata = { title: "通知" };

export default async function AdminNotificationsPage() {
  const [preview, history] = await Promise.all([previewEveningDigest(), listNotifications()]);
  const lineTargets = preview.targets.filter((t) => t.lineUserId).length;
  return (
    <div className="space-y-6">
      <PageHeader
        title="通知"
        sub={`旧まとめ通知（エリアごとの件数）の記録だけを行います（1人あたり${DIGEST_COOLDOWN_HOURS}時間に1通まで）。LINE への配信は「LINE日次通知」から行います。`}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">今夜のTABETUNAGU（プレビュー）</h2>
            <Badge tone="sand">記録のみ</Badge>
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
            {" 全員への一斉配信にならないよう、LINE へは送りません（対象者の記録だけ）。"}
          </p>
          <div className="mt-4">
            <ActionButton action={sendDigestAction} label="通知対象を作成する（記録のみ）" variant="dark" confirm="まとめ通知を作成します。よろしいですか？" />
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
