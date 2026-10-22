import type { Metadata } from "next";
import { togglePublishAction, verifyStoreAction } from "@/app/actions/stores";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { AccessDenied } from "@/components/layout/AppShell";
import { Badge, Card, Notice, PageHeader } from "@/components/ui/primitives";
import { AREAS, areaLabel, genreLabel } from "@/lib/shared/dictionaries";
import { resolveAdminContext } from "@/lib/server/admin-context";
import { listStoresForAdmin } from "@/lib/server/services/dashboard-service";

export const metadata: Metadata = { title: "店舗マスター｜運営" };

type Props = { searchParams: Promise<{ area?: string; filter?: string }> };

export default async function AdminStoresPage({ searchParams }: Props) {
  const ctx = await resolveAdminContext();
  if (!ctx.ok) return <AccessDenied message={ctx.reason} />;
  const sp = await searchParams;
  const rows = listStoresForAdmin(ctx.actor).filter(({ store, duplicateOf }) => {
    if (sp.area && store.areaId !== sp.area) return false;
    if (sp.filter === "attention") return !store.published || store.verification.status !== "verified" || duplicateOf.length > 0 || !store.budget.basis;
    return true;
  });

  return (
    <AdminFrame active="stores" accountLabel={ctx.accountLabel}>
      <PageHeader title="店舗マスター" description={`共通の store_id でなまらAIとNAMARA REVIEWを紐づけています。表示中 ${rows.length} 店舗。`} />
      <Notice tone="warn">サンプル店舗はすべて架空です。本番の店舗追加は、運営が情報源と利用許可を確認してから行います（店舗追加フォームは Phase 2 で Supabase 接続後に実装）。</Notice>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col">
          <span className="text-xs text-muted">エリア</span>
          <select name="area" defaultValue={sp.area ?? ""} className="rounded border border-line bg-paper px-2 py-1.5">
            <option value="">すべて</option>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="text-xs text-muted">絞り込み</span>
          <select name="filter" defaultValue={sp.filter ?? ""} className="rounded border border-line bg-paper px-2 py-1.5">
            <option value="">すべて</option>
            <option value="attention">要確認（非公開・未検証・重複候補・価格不明）</option>
          </select>
        </label>
        <button type="submit" className="rounded border border-line bg-paper px-3 py-1.5">表示</button>
      </form>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">店舗名</th>
              <th className="px-3 py-2 font-medium">エリア／ジャンル</th>
              <th className="px-3 py-2 font-medium">データソース・確認日</th>
              <th className="px-3 py-2 font-medium">状態</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ store, duplicateOf }) => (
              <tr key={store.id} className="border-t border-line align-top">
                <td className="px-3 py-2 text-xs text-muted">{store.id}</td>
                <td className="px-3 py-2">
                  {store.name}
                  {duplicateOf.length > 0 && <span className="block text-xs text-ad">重複候補：{duplicateOf.join(", ")}</span>}
                  {!store.budget.basis && <span className="block text-xs text-muted">価格情報：不明</span>}
                </td>
                <td className="px-3 py-2 text-xs">{areaLabel(store.areaId)}／{store.genreIds.map(genreLabel).join("・")}</td>
                <td className="px-3 py-2 text-xs">
                  {store.verification.source === "sample" ? "サンプル（架空）" : store.verification.source}
                  <span className="block text-muted">確認日：{store.verification.verifiedAt ?? "未確認"}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {store.published ? <Badge tone="good">公開</Badge> : <Badge tone="muted">非公開</Badge>}
                    {store.verification.status === "verified" ? <Badge>検証済み</Badge> : <Badge tone="bad">未検証</Badge>}
                    {store.organizationId && <Badge tone="navy">契約</Badge>}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <form action={verifyStoreAction}>
                      <input type="hidden" name="storeId" value={store.id} />
                      <button type="submit" className="rounded border border-line px-2 py-1 text-xs hover:border-blue">確認日を更新</button>
                    </form>
                    <form action={togglePublishAction}>
                      <input type="hidden" name="storeId" value={store.id} />
                      <input type="hidden" name="publish" value={store.published ? "0" : "1"} />
                      <button type="submit" disabled={!store.published && store.verification.status !== "verified"} className="rounded border border-line px-2 py-1 text-xs hover:border-blue disabled:opacity-40">
                        {store.published ? "非公開にする" : "公開する"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AdminFrame>
  );
}
