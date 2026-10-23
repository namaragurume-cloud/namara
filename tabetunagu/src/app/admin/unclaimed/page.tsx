import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { EmptyState } from "@/components/ui/Section";
import { dateTime, yen } from "@/lib/format";
import { requireAdmin } from "@/server/auth/viewer";
import { listRecentUnclaimed } from "@/server/services/ops";

export const metadata: Metadata = { title: "未受取" };

const hourFmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "numeric", hour12: false });

/** 直近30日の未受取。店舗・時間帯の傾向を見るための一覧（お客様の情報は表示しない） */
export default async function AdminUnclaimedPage() {
  await requireAdmin("/admin/unclaimed");
  const rows = await listRecentUnclaimed(30);
  const byStore = new Map<string, number>();
  const byHour = new Map<number, number>();
  for (const r of rows) {
    byStore.set(r.storeName, (byStore.get(r.storeName) ?? 0) + 1);
    const h = Number(hourFmt.format(new Date(r.pickupEnd)));
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  return (
    <div className="space-y-5">
      <PageHeader title="未受取（直近30日）" sub={`${rows.length}件。未受取でも売上は確定のまま（返金・ポイント取り消しなし）。`} />
      {rows.length === 0 ? (
        <EmptyState title="未受取の注文はありません" />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <section className="card p-4">
              <h2 className="mb-2 text-[14px] font-bold">店舗別</h2>
              <ul className="space-y-1 text-[13px]">
                {[...byStore.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => (
                  <li key={name} className="flex justify-between">
                    <span>{name}</span>
                    <span className="tnum font-semibold">{n}件</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card p-4">
              <h2 className="mb-2 text-[14px] font-bold">受取終了の時間帯別</h2>
              <ul className="space-y-1 text-[13px]">
                {[...byHour.entries()].sort((a, b) => a[0] - b[0]).map(([h, n]) => (
                  <li key={h} className="flex justify-between">
                    <span className="tnum">{h}時台</span>
                    <span className="tnum font-semibold">{n}件</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]" data-testid="unclaimed-table">
              <thead className="text-left text-[12px] text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5">店舗</th>
                  <th className="px-3 py-2.5">商品</th>
                  <th className="px-3 py-2.5">注文番号</th>
                  <th className="px-3 py-2.5">受取終了</th>
                  <th className="px-3 py-2.5">未受取の判定</th>
                  <th className="px-4 py-2.5 text-right">金額</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.orderId} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">{r.storeName}</td>
                    <td className="px-3 py-3">{r.items}</td>
                    <td className="font-en px-3 py-3">#{r.orderNumber}</td>
                    <td className="tnum px-3 py-3">{dateTime(r.pickupEnd)}</td>
                    <td className="tnum px-3 py-3">{dateTime(r.unclaimedAt)}</td>
                    <td className="tnum px-4 py-3 text-right">{yen(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
