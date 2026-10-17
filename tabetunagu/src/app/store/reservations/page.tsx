import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { StoreCancelForm } from "@/components/store/StoreCancelForm";
import { EmptyState, Notice } from "@/components/ui/Section";
import { ReservationStatusBadge } from "@/components/ui/StatusBadge";
import { hhmm, monthDay, yen, ymd } from "@/lib/format";
import { requireStoreMember } from "@/server/auth/viewer";
import { listStoreReservations } from "@/server/services/store";

export const metadata: Metadata = { title: "予約状況" };

export default async function StoreReservationsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const { viewer, store } = await requireStoreMember("/store/reservations");
  const data = await listStoreReservations(viewer.id, store.storeId, date ?? ymd());
  const base = new Date(`${data.date}T12:00:00+09:00`);
  const shift = (days: number) => ymd(new Date(base.getTime() + days * 86_400_000));
  const waiting = data.rows.filter((r) => r.status === "confirmed" || r.status === "pending");
  const done = data.rows.filter((r) => r.status === "completed");

  return (
    <div>
      <PageHeader
        title="予約状況"
        sub={`${monthDay(base)} 受取分・予約 ${data.rows.filter((r) => r.status !== "cancelled").length}件 / 来店待ち ${waiting.length}件 / 完了 ${done.length}件`}
        action={
          <div className="flex items-center gap-1 text-[13px] font-semibold">
            <Link href={`/store/reservations?date=${shift(-1)}`} className="rounded-full border border-line bg-paper px-3 py-1.5">
              前日
            </Link>
            <Link href="/store/reservations" className="rounded-full border border-line bg-paper px-3 py-1.5">
              今日
            </Link>
            <Link href={`/store/reservations?date=${shift(1)}`} className="rounded-full border border-line bg-paper px-3 py-1.5">
              翌日
            </Link>
          </div>
        }
      />
      <div className="mb-4">
        <Notice>
          お客様が店頭のQRを読み取ると「食べつなぎ完了」になります（店舗での完了操作は不要です）。予約番号はお客様の画面に表示されています。
        </Notice>
      </div>
      {data.rows.length === 0 ? (
        <EmptyState title="この日の予約はありません" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="text-left text-[12px] text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-semibold">予約番号</th>
                <th className="px-3 py-2.5 font-semibold">お客様</th>
                <th className="px-3 py-2.5 font-semibold">商品</th>
                <th className="px-3 py-2.5 text-right font-semibold">数量・金額</th>
                <th className="px-3 py-2.5 font-semibold">受取時間</th>
                <th className="px-3 py-2.5 font-semibold">状態</th>
                <th className="px-4 py-2.5 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="tnum px-4 py-3 text-[15px] font-semibold tracking-[0.1em]">{r.code}</td>
                  <td className="px-3 py-3">{r.userName}</td>
                  <td className="px-3 py-3">{r.productName}</td>
                  <td className="tnum px-3 py-3 text-right">
                    {r.quantity}・{yen(r.totalPrice)}
                  </td>
                  <td className="tnum px-3 py-3">
                    {hhmm(r.pickupStartAt)}〜{hhmm(r.pickupEndAt)}
                  </td>
                  <td className="px-3 py-3">
                    <ReservationStatusBadge status={r.status} pickupEndAt={r.pickupEndAt} />
                    {r.status === "completed" && r.completedAt && <span className="tnum ml-1.5 text-[11px] text-muted">{hhmm(r.completedAt)}</span>}
                    {r.status === "cancelled" && r.cancelledBy === "store" && <span className="ml-1.5 text-[11px] text-muted">店舗都合</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(r.status === "confirmed" || r.status === "pending") && <StoreCancelForm storeId={store.storeId} reservationId={r.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
