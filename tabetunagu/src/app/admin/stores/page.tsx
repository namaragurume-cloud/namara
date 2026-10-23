import type { Metadata } from "next";
import Link from "next/link";
import { createStoreAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/ActionButton";
import { FlagBadge } from "@/components/admin/FlagBadge";
import { parsePeriod, PeriodTabs } from "@/components/admin/PeriodTabs";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { Badge } from "@/components/ui/Badge";
import { AREAS, areaLabel, CATEGORIES } from "@/lib/categories";
import { percent, yen } from "@/lib/format";
import { listStoresWithMetrics } from "@/server/services/admin";
import { getStoreReadiness } from "@/server/services/readiness";

export const metadata: Metadata = { title: "店舗" };

const STATUS = { active: "稼働中", pending: "審査中", suspended: "停止中" } as Record<string, string>;

export default async function AdminStoresPage({ searchParams }: { searchParams: Promise<{ period?: string; sort?: string }> }) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  let stores = await listStoresWithMetrics(period);
  const readiness = await getStoreReadiness();
  if (sp.sort === "qr") stores = [...stores].sort((a, b) => (a.qrRate ?? 2) - (b.qrRate ?? 2));
  const free = stores.filter((s) => s.plan === "free" && s.status !== "suspended").length;
  const standard = stores.filter((s) => s.plan === "standard" && s.status !== "suspended").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="店舗"
        sub={`${stores.length}店舗・FREE ${free} / STANDARD ${standard}`}
        action={<PeriodTabs base="/admin/stores" period={period} extra={sp.sort ? `&sort=${sp.sort}` : ""} />}
      />
      <div className="flex gap-2 text-[12px] font-semibold">
        <Link href={`/admin/stores?period=${period}`} className={!sp.sort ? "text-ink" : "text-muted"}>
          予約数順
        </Link>
        <Link href={`/admin/stores?period=${period}&sort=qr`} className={sp.sort === "qr" ? "text-ink" : "text-muted"}>
          QR完了率が低い順
        </Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px] text-[13px]">
          <thead className="text-left text-[12px] text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5">店舗</th>
              <th className="px-3 py-2.5">エリア</th>
              <th className="px-3 py-2.5">プラン</th>
              <th className="px-3 py-2.5">状態</th>
              <th className="px-3 py-2.5">公開準備</th>
              <th className="px-3 py-2.5 text-right">出品</th>
              <th className="px-3 py-2.5 text-right">予約</th>
              <th className="px-3 py-2.5 text-right">成約</th>
              <th className="px-3 py-2.5 text-right">未来店</th>
              <th className="px-3 py-2.5 text-right">店舗都合キャンセル</th>
              <th className="px-3 py-2.5 text-right">QR失敗</th>
              <th className="px-3 py-2.5 text-right">予約→QR完了率</th>
              <th className="px-3 py-2.5 text-right">GMV</th>
              <th className="px-3 py-2.5 text-right">手数料</th>
              <th className="px-4 py-2.5">判定</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/stores/${s.id}`} className="font-semibold hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-3 py-3">{areaLabel(s.areaId)}</td>
                <td className="px-3 py-3">
                  <Badge tone={s.plan === "standard" ? "dark" : "outline"}>{s.plan.toUpperCase()}</Badge>
                </td>
                <td className="px-3 py-3">{STATUS[s.status] ?? s.status}</td>
                <td className="px-3 py-3" data-testid="store-launch-status">
                  <LaunchBadge status={readiness.get(s.id)?.status} />
                </td>
                <td className="tnum px-3 py-3 text-right">{s.listings}</td>
                <td className="tnum px-3 py-3 text-right">{s.reservations}</td>
                <td className="tnum px-3 py-3 text-right">{s.completed}</td>
                <td className="tnum px-3 py-3 text-right">{s.noShow}</td>
                <td className="tnum px-3 py-3 text-right">{s.storeCancelled}</td>
                <td className="tnum px-3 py-3 text-right">{s.failedCheckins}</td>
                <td className="tnum px-3 py-3 text-right font-semibold">{percent(s.qrRate)}</td>
                <td className="tnum px-3 py-3 text-right">{yen(s.gmv)}</td>
                <td className="tnum px-3 py-3 text-right">{yen(s.commission)}</td>
                <td className="px-4 py-3">
                  <FlagBadge flag={s.flag} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 text-[15px] font-bold">店舗を追加</h2>
        <ActionForm action={createStoreAction} submitLabel="追加する（審査中で作成）" className="grid items-end gap-3 md:grid-cols-5">
          <div>
            <label className="label" htmlFor="name">
              店舗名
            </label>
            <input id="name" name="name" required className="field" />
          </div>
          <div>
            <label className="label" htmlFor="slug">
              URL名
            </label>
            <input id="slug" name="slug" required pattern="[a-z0-9-]{2,64}" placeholder="odori-bakery" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="areaId">
              エリア
            </label>
            <select id="areaId" name="areaId" className="field">
              {AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="category">
              カテゴリー
            </label>
            <select id="category" name="category" className="field">
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}

function LaunchBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-muted">—</span>;
  const tone = status === "公開準備OK" ? "green" : status === "Stripe設定待ち" ? "sand" : status === "商品準備中" ? "outline" : "clay";
  return <Badge tone={tone}>{status}</Badge>;
}
