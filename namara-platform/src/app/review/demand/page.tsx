import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied } from "@/components/layout/AppShell";
import { ReviewFrame } from "@/components/review/ReviewFrame";
import { BarList } from "@/components/ui/charts";
import { Card, EmptyState, Kpi, Notice, PageHeader, SyntheticNotice, fmt } from "@/components/ui/primitives";
import type { MonthComparison } from "@/lib/analytics/aggregate";
import { resolveReviewContext } from "@/lib/server/review-context";
import { getStoreDemand } from "@/lib/server/services/dashboard-service";

export const metadata: Metadata = { title: "NAMARA DEMAND｜NAMARA REVIEW" };

type Props = { searchParams: Promise<{ store?: string; scope?: string }> };

const toBars = (rows: MonthComparison[]) => rows.map((r) => ({ key: r.key, label: r.label, value: r.current, delta: r.changePct, hint: r.previous !== null ? `前月同期間：約${fmt(r.previous)}回` : "前月：少数または0件" }));

function Breakdown({ title, rows, sufficient }: { title: string; rows: MonthComparison[]; sufficient: boolean }) {
  return (
    <Card title={title} description="今月の検索回数（5単位で丸め）と前月比">
      {sufficient ? <BarList items={toBars(rows)} /> : <EmptyState title="分析に必要なデータが不足しています" />}
    </Card>
  );
}

export default async function DemandPage({ searchParams }: Props) {
  const sp = await searchParams;
  const ctx = await resolveReviewContext(sp.store);
  if (!ctx.ok) return <AccessDenied message={ctx.reason} />;
  const scope = sp.scope === "all" ? "all" : "area";
  const d = getStoreDemand(ctx.actor, ctx.store.id, scope);
  const rising = [...d.comparisons.feature, ...d.comparisons.scene, ...d.comparisons.genre]
    .filter((r) => r.changePct !== null && r.changePct >= 20 && (r.current ?? 0) >= 10)
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
    .slice(0, 3);

  const scopeLink = (s: "area" | "all", label: string) => (
    <Link
      href={`/review/demand?store=${ctx.store.id}&scope=${s}`}
      aria-current={scope === s ? "page" : undefined}
      className={`rounded-full border px-3 py-1 text-sm ${scope === s ? "border-navy bg-navy text-white" : "border-line bg-paper text-ink hover:border-blue"}`}
    >
      {label}
    </Link>
  );

  return (
    <ReviewFrame active="demand" store={ctx.store} stores={ctx.stores} accountLabel={ctx.accountLabel}>
      <PageHeader
        title="NAMARA DEMAND｜検索需要分析"
        description={`なまらAIで「${d.scopeLabel}」のお店を探した人の条件を、個人を特定できない形で集計しています。`}
        action={<div className="flex gap-2">{scopeLink("area", "自店のエリア")}{scopeLink("all", "全エリア")}</div>}
      />
      <div className="space-y-3">
        {d.current.synthetic && <SyntheticNotice />}
        <Notice>
          検索回数は<strong>来店数ではありません</strong>。利用者数が{d.minCell}人未満の区分は「少数のため非表示」とし、件数は5単位で丸めています。
        </Notice>
      </div>

      {!d.current.sufficient ? (
        <div className="mt-6">
          <EmptyState title="分析に必要なデータが不足しています">このエリアの検索数がまだ少ないため、集計を表示できません。</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label={`${d.scopeLabel}の検索回数（今月）`} value={`約${fmt(d.current.totalSearches ?? 0)}`} unit="回" />
            <Kpi label="自店の表示回数" value={fmt(d.ownExposure.impressions)} unit="回" />
            <Kpi label="自店の詳細閲覧" value={fmt(d.ownExposure.detail)} unit="回" />
            <Kpi label="表示→詳細の割合" value={d.ownExposure.detailRate ?? "—"} unit={d.ownExposure.detailRate !== null ? "%" : undefined} note={d.ownExposure.detailRate === null ? "表示回数が少ないため算出していません" : undefined} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="集客機会のAI分析" description="モック：ルールベース。根拠はすべて上の集計値です">
              {rising.length ? (
                <ul className="space-y-3 text-sm">
                  {rising.map((r) => (
                    <li key={r.key} className="rounded-lg bg-blue-soft px-3 py-2">
                      <strong className="text-navy">「{r.label}」</strong>を含む検索が前月同期間比 <strong>+{r.changePct}%</strong>（約{fmt(r.current ?? 0)}回）。
                      対応できる場合は、店舗情報への掲載やSNS投稿でアピールする余地があります。
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="目立って伸びている条件はありません" />
              )}
            </Card>
            <Card title="条件に合う店が少ない検索テーマ" description="検索はあるのに、表示できる店舗が平均3件未満の組み合わせ">
              {d.underserved.length ? (
                <ul className="divide-y divide-line text-sm">
                  {d.underserved.map((u) => (
                    <li key={u.label} className="flex justify-between py-2">
                      <span>{u.label}</span>
                      <span className="tabular-nums text-muted">
                        約{fmt(u.searches)}回／平均{u.avgResults}件表示
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="該当するテーマはありません" />
              )}
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Breakdown title="ジャンル別" rows={d.comparisons.genre} sufficient={d.current.sufficient} />
            <Breakdown title="予算帯別（1人あたり）" rows={d.comparisons.budget} sufficient={d.current.sufficient} />
            <Breakdown title="利用シーン別" rows={d.comparisons.scene} sufficient={d.current.sufficient} />
            <Breakdown title="人気の希望条件" rows={d.comparisons.feature} sufficient={d.current.sufficient} />
            {scope === "all" && <Breakdown title="エリア別" rows={d.comparisons.area} sufficient={d.current.sufficient} />}
          </div>
        </>
      )}
    </ReviewFrame>
  );
}
