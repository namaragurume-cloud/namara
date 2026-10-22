import type { Metadata } from "next";
import { stopCampaignAction } from "@/app/actions/ads";
import { AccessDenied } from "@/components/layout/AppShell";
import { CampaignForm } from "@/components/review/CampaignForm";
import { CampaignStatusBadge } from "@/components/review/CampaignStatus";
import { ReviewFrame } from "@/components/review/ReviewFrame";
import { Card, EmptyState, Notice, PageHeader, fmt } from "@/components/ui/primitives";
import { areaLabel, genreLabel } from "@/lib/shared/dictionaries";
import { resolveReviewContext } from "@/lib/server/review-context";
import { listStoreCampaigns } from "@/lib/server/services/ad-service";

function defaultCampaignDates(now: Date) {
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 30);
  return { today: now.toISOString().slice(0, 10), defaultEnd: end.toISOString().slice(0, 10) };
}

export const metadata: Metadata = { title: "スポンサー広告｜NAMARA REVIEW" };

type Props = { searchParams: Promise<{ store?: string }> };

export default async function StoreAdsPage({ searchParams }: Props) {
  const ctx = await resolveReviewContext((await searchParams).store);
  if (!ctx.ok) return <AccessDenied message={ctx.reason} />;
  const campaigns = listStoreCampaigns(ctx.actor, ctx.store.id);
  const canManage = ctx.actor.kind === "operator" || (ctx.actor.kind === "store_member" && ctx.actor.role === "owner");
  const { today, defaultEnd } = defaultCampaignDates(new Date());

  return (
    <ReviewFrame active="ads" store={ctx.store} stores={ctx.stores} accountLabel={ctx.accountLabel}>
      <PageHeader title="スポンサー検索広告" description="なまらAIの検索結果に「広告」と明示した枠（最大1件）で表示されます。通常のおすすめ順位は変わりません。" />
      <Notice>
        広告は、利用者の検索条件（エリア・ジャンル・予算・希望条件）に合うときだけ表示されます。条件に合わない検索には表示されません。表示回数・クリック数はモック計測で、請求・決済は行いません。
      </Notice>

      <div className="mt-6 space-y-4">
        {campaigns.length === 0 && <EmptyState title="まだキャンペーンがありません" />}
        {campaigns.map((c) => (
          <Card
            key={c.campaign.id}
            title={c.campaign.name}
            description={`${c.campaign.startDate}〜${c.campaign.endDate}｜対象：${c.campaign.targeting.areaIds.map(areaLabel).join("・")} × ${c.campaign.targeting.genreIds.map(genreLabel).join("・")}`}
            action={<CampaignStatusBadge status={c.campaign.status} />}
          >
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-6">
              {[
                ["表示回数", `${fmt(c.impressions)}回`],
                ["クリック数（有効）", `${fmt(c.clicks)}回`],
                ["クリック率", c.ctr !== null ? `${c.ctr}%` : "—"],
                ["使用金額（モック）", `${fmt(c.spentYen)}円`],
                ["予算残高", `${fmt(c.remainingYen)}円`],
                ["無効クリック（課金なし）", `${fmt(c.invalidClicks)}回`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="font-bold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            {c.campaign.reviewNote && <p className="mt-3 text-xs text-muted">審査メモ：{c.campaign.reviewNote}</p>}
            {canManage && ["approved", "pending_review", "paused"].includes(c.campaign.status) && (
              <form action={stopCampaignAction} className="mt-3">
                <input type="hidden" name="campaignId" value={c.campaign.id} />
                <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-bad hover:text-bad">
                  配信を停止する
                </button>
              </form>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Card title="新しいキャンペーンを申請" description="作成後は運営の審査を経て配信されます">
          {canManage ? <CampaignForm store={ctx.store} today={today} defaultEnd={defaultEnd} /> : <p className="text-sm text-muted">スタッフ権限では広告を作成・変更できません。店舗オーナーにご依頼ください。</p>}
        </Card>
      </div>
    </ReviewFrame>
  );
}
