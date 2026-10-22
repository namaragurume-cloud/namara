import type { Metadata } from "next";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { AccessDenied } from "@/components/layout/AppShell";
import { BarList, LineChart } from "@/components/ui/charts";
import { Card, Kpi, PageHeader, SyntheticNotice, fmt } from "@/components/ui/primitives";
import { planName } from "@/lib/data/plans";
import { resolveAdminContext } from "@/lib/server/admin-context";
import { getAdminOverview } from "@/lib/server/services/dashboard-service";

export const metadata: Metadata = { title: "運営ダッシュボード" };

export default async function AdminOverviewPage() {
  const ctx = await resolveAdminContext();
  if (!ctx.ok) return <AccessDenied message={ctx.reason} />;
  const d = getAdminOverview(ctx.actor);

  return (
    <AdminFrame active="overview" accountLabel={ctx.accountLabel}>
      <PageHeader title="運営ダッシュボード" description={`今月（${d.period.from.toISOString().slice(0, 10)}〜本日）。運営画面では少数セル抑制をかけない内部集計を表示します（店舗には提供しません）。`} />
      {d.synthetic && (
        <div className="mb-6">
          <SyntheticNotice />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="利用者数（仮名セッション）" value={fmt(d.users)} unit="人" />
        <Kpi label="検索回数" value={fmt(d.searches)} unit="回" sub={`LINE ${fmt(d.channelSplit.line)}／Web ${fmt(d.channelSplit.web)}`} />
        <Kpi label="検索結果ゼロ件の割合" value={d.zeroResultRate ?? "—"} unit="%" />
        <Kpi label="おすすめ表示回数" value={fmt(d.recommendationImpressions)} unit="回" />
        <Kpi label="広告表示／有効クリック" value={`${fmt(d.ads.impressions)}／${fmt(d.ads.validClicks)}`} sub={`無効 ${fmt(d.ads.invalidClicks)}回`} />
        <Kpi label="広告審査待ち" value={fmt(d.ads.pendingReview)} unit="件" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="検索回数（直近30日）" className="lg:col-span-2">
          <LineChart series={d.searchSeries} label="検索回数" />
        </Card>
        <Card title="エリア別の需要" description="今月・5単位で丸め">
          <BarList items={d.areaDemand.map((c) => ({ key: c.key, label: c.label, value: c.searches }))} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="人気の検索条件" description="辞書で正規化した条件（自由入力の生テキストではありません）">
          <BarList items={d.popular.map((p) => ({ key: p.label, label: p.label, value: p.count }))} />
        </Card>
        <Card title="検索結果ゼロ件の分析" description="店舗開拓・掲載情報の追加の優先度づけに使います">
          <BarList items={d.zeroResults.map((p) => ({ key: p.label, label: p.label, value: p.count }))} emptyText="ゼロ件の検索はありません" />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="契約店舗一覧（デモ）">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 font-medium">組織</th>
                <th className="py-1 font-medium">プラン</th>
                <th className="py-1 font-medium">店舗</th>
              </tr>
            </thead>
            <tbody>
              {d.contracts.map((c) => (
                <tr key={c.id} className="border-t border-line align-top">
                  <td className="py-2">{c.name}</td>
                  <td className="py-2">{planName(c.plan)}</td>
                  <td className="py-2">{c.stores.map((s) => s.name).join("、")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="監査ログ（直近）" description="広告・店舗情報の変更操作を記録しています">
          {d.recentAudit.length === 0 ? (
            <p className="text-sm text-muted">このサーバー起動後の操作はまだありません。</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {d.recentAudit.map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span className="text-muted tabular-nums">{a.createdAt.slice(0, 19).replace("T", " ")}</span>
                  <span className="font-medium">{a.action}</span>
                  <span className="text-muted">{a.targetId}</span>
                  <span className="text-muted">by {a.actorId}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminFrame>
  );
}
