import type { Metadata } from "next";
import { reviewCampaignAction } from "@/app/actions/ads";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { AccessDenied } from "@/components/layout/AppShell";
import { CampaignStatusBadge } from "@/components/review/CampaignStatus";
import { Card, Notice, PageHeader, fmt } from "@/components/ui/primitives";
import { areaLabel, genreLabel } from "@/lib/shared/dictionaries";
import { resolveAdminContext } from "@/lib/server/admin-context";
import { listAllCampaigns } from "@/lib/server/services/ad-service";

export const metadata: Metadata = { title: "広告審査・配信｜運営" };

export default async function AdminAdsPage() {
  const ctx = await resolveAdminContext();
  if (!ctx.ok) return <AccessDenied message={ctx.reason} />;
  const rows = listAllCampaigns(ctx.actor);
  const pending = rows.filter((r) => r.campaign.status === "pending_review");

  return (
    <AdminFrame active="ads" accountLabel={ctx.accountLabel}>
      <PageHeader title="広告審査・配信状況" description="審査・停止の操作はすべて監査ログに記録されます。" />
      <Notice>
        審査基準（docs/AD_POLICY.md）：店舗情報が検証済みであること、誇大・虚偽表現がないこと、口コミ投稿を条件とする特典がないこと。予算上限に達したキャンペーンは自動停止します。請求はモック（実際の決済なし）。
      </Notice>

      <h2 className="mt-6 mb-3 font-bold">審査待ち（{pending.length}件）</h2>
      <div className="space-y-3">
        {pending.length === 0 && <p className="text-sm text-muted">審査待ちのキャンペーンはありません。</p>}
        {pending.map((r) => (
          <Card key={r.campaign.id} title={r.campaign.name} description={`${r.storeName}｜${r.campaign.startDate}〜${r.campaign.endDate}｜予算 ${fmt(r.campaign.budgetYen)}円`}>
            <form action={reviewCampaignAction} className="flex flex-wrap items-end gap-2 text-sm">
              <input type="hidden" name="campaignId" value={r.campaign.id} />
              <label className="flex flex-1 flex-col">
                <span className="text-xs text-muted">審査メモ（店舗に表示されます）</span>
                <input name="note" maxLength={200} className="rounded border border-line px-2 py-1.5" />
              </label>
              <button name="decision" value="approve" className="rounded bg-navy px-3 py-1.5 font-bold text-white">承認</button>
              <button name="decision" value="reject" className="rounded border border-line px-3 py-1.5 hover:border-bad hover:text-bad">否認</button>
            </form>
          </Card>
        ))}
      </div>

      <h2 className="mt-8 mb-3 font-bold">全キャンペーン</h2>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">キャンペーン／店舗</th>
              <th className="px-3 py-2 font-medium">対象</th>
              <th className="px-3 py-2 font-medium">状態</th>
              <th className="px-3 py-2 text-right font-medium">表示</th>
              <th className="px-3 py-2 text-right font-medium">有効クリック</th>
              <th className="px-3 py-2 text-right font-medium">無効クリック</th>
              <th className="px-3 py-2 text-right font-medium">請求見込み（モック）</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.campaign.id} className="border-t border-line align-top">
                <td className="px-3 py-2">
                  {r.campaign.name}
                  <span className="block text-xs text-muted">{r.storeName}</span>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.campaign.targeting.areaIds.map(areaLabel).join("・")} × {r.campaign.targeting.genreIds.map(genreLabel).join("・")}
                </td>
                <td className="px-3 py-2"><CampaignStatusBadge status={r.campaign.status} /></td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(r.impressions)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(r.clicks)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(r.invalidClicks)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(r.spentYen)}円 / {fmt(r.campaign.budgetYen)}円</td>
                <td className="px-3 py-2">
                  {r.campaign.status === "approved" && (
                    <form action={reviewCampaignAction}>
                      <input type="hidden" name="campaignId" value={r.campaign.id} />
                      <input type="hidden" name="note" value="運営により停止" />
                      <button name="decision" value="stop" className="rounded border border-line px-2 py-1 text-xs hover:border-bad hover:text-bad">配信停止</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AdminFrame>
  );
}
