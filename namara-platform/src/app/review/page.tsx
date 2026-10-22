import type { Metadata } from "next";
import { Star } from "lucide-react";
import { AccessDenied } from "@/components/layout/AppShell";
import { ReviewFrame } from "@/components/review/ReviewFrame";
import { BarList, LineChart } from "@/components/ui/charts";
import { Badge, Card, EmptyState, Kpi, PageHeader, SyntheticNotice, fmt, percentChange } from "@/components/ui/primitives";
import { resolveReviewContext } from "@/lib/server/review-context";
import { getStoreDashboard } from "@/lib/server/services/dashboard-service";

export const metadata: Metadata = { title: "ダッシュボード｜NAMARA REVIEW" };

type Props = { searchParams: Promise<{ store?: string }> };

export default async function ReviewDashboardPage({ searchParams }: Props) {
  const ctx = await resolveReviewContext((await searchParams).store);
  if (!ctx.ok) return <AccessDenied message={ctx.reason} />;
  const d = getStoreDashboard(ctx.actor, ctx.store.id);
  const ex = d.exposure;

  return (
    <ReviewFrame active="dashboard" store={ctx.store} stores={ctx.stores} accountLabel={ctx.accountLabel}>
      <PageHeader title={d.store.name} description={`今月（${d.period.from.toISOString().slice(0, 10)}〜本日）の状況。前月比は前月の同じ日数との比較です。`} />
      {d.synthetic && (
        <div className="mb-6">
          <SyntheticNotice />
        </div>
      )}

      <h2 className="mb-3 text-sm font-bold text-muted">口コミ（Google口コミ連携はモック）</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="総口コミ数" value={fmt(d.reviews.total)} unit="件" />
        <Kpi label="平均評価" value={d.reviews.average !== null ? d.reviews.average.toFixed(1) : "—"} sub={<span className="inline-flex items-center gap-0.5"><Star className="size-3" aria-hidden />5点満点</span>} />
        <Kpi label="今月の新規口コミ" value={fmt(d.reviews.newThisMonth)} unit="件" />
        <Kpi label="未返信" value={fmt(d.reviews.unreplied)} unit="件" />
        <Kpi label="AI返信案（承認待ち）" value={fmt(d.reviews.aiDrafts)} unit="件" note="投稿には人の承認が必要" />
      </div>

      <h2 className="mt-8 mb-3 text-sm font-bold text-muted">なまらAIでの表示・クリック（計測値は来店数ではありません）</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="検索結果への表示回数" value={fmt(ex.current.impressions)} unit="回" delta={percentChange(ex.current.impressions, ex.previous.impressions)} sub="前月比" />
        <Kpi label="詳細の閲覧回数" value={fmt(ex.current.detail)} unit="回" delta={percentChange(ex.current.detail, ex.previous.detail)} sub="前月比" />
        <Kpi label="地図クリック" value={fmt(ex.current.map)} unit="回" delta={percentChange(ex.current.map, ex.previous.map)} sub="前月比" />
        <Kpi label="予約リンククリック" value={fmt(ex.current.reservation)} unit="回" delta={percentChange(ex.current.reservation, ex.previous.reservation)} sub="前月比" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="検索結果への表示回数（直近30日）" className="lg:col-span-2">
          <LineChart series={d.dailyImpressions} label="検索結果への表示回数" />
        </Card>
        <Card title={`${d.areaDemand.areaLabel}エリアの検索需要`} description="今月・ジャンル別（匿名集計）">
          {d.areaDemand.summary.sufficient ? (
            <BarList items={d.areaDemand.topGenres.map((c) => ({ key: c.key, label: c.label, value: c.searches }))} />
          ) : (
            <EmptyState title="分析に必要なデータが不足しています">検索数が一定数たまると表示されます。</EmptyState>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="AI店長の改善提案" description="今週の改善アクション（モック：ルールベースで生成。根拠の数値はすべて計測・集計値）" className="lg:col-span-2">
          <ol className="space-y-4">
            {d.actions.map((a, i) => (
              <li key={a.id} className="rounded-lg border border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{i + 1}</span>
                  <p className="font-bold text-ink">{a.title}</p>
                  <Badge tone={a.priority === "高" ? "bad" : a.priority === "中" ? "default" : "muted"}>優先度：{a.priority}</Badge>
                </div>
                <ul className="mt-2 list-disc space-y-0.5 pl-9 text-sm text-muted">
                  {a.evidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                <p className="mt-2 pl-8 text-xs text-muted">
                  担当（案）：{a.owner}｜期限（案）：{a.dueInDays}日以内｜状況：未着手（進捗管理は Phase 9 で実装）
                </p>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="最近の口コミ" description="モックデータ（架空の投稿）">
          <ul className="space-y-3 text-sm">
            {d.reviews.latest.map((r) => (
              <li key={r.id} className="border-b border-line pb-3 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-ad" aria-label={`${r.rating}点`}>{"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span></span>
                  <span className="text-xs text-muted">{r.createdAt.slice(0, 10)}</span>
                </div>
                <p className="mt-1 text-ink">{r.text}</p>
                <p className="mt-1 text-xs">
                  {r.reply ? <Badge tone="good">返信済み</Badge> : r.draft ? <Badge>AI返信案あり（未承認）</Badge> : <Badge tone="bad">未返信</Badge>}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </ReviewFrame>
  );
}
