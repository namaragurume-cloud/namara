import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { cn } from "@/components/ui/cn";
import { ReservationStatusBadge } from "@/components/ui/StatusBadge";
import { dateTime, pickupLabel, yen } from "@/lib/format";
import { listAllReservations } from "@/server/services/admin";
import { requireAdmin } from "@/server/auth/viewer";

export const metadata: Metadata = { title: "予約・成約" };

const TABS = [
  { id: "", label: "すべての予約" },
  { id: "completed", label: "成約一覧" },
  { id: "confirmed", label: "来店待ち" },
  { id: "no_show", label: "No Show" },
  { id: "cancelled", label: "キャンセル" },
  { id: "expired", label: "期限切れ" },
];

export default async function AdminReservationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin("/admin/reservations");
  const status = (await searchParams).status ?? "";
  const rows = await listAllReservations(status || undefined);
  const gmv = rows.filter((r) => r.status === "completed").reduce((s, r) => s + Number(r.total_price), 0);
  return (
    <div className="space-y-5">
      <PageHeader title="予約・成約" sub={`表示 ${rows.length}件（最大300件）${status === "completed" ? `・成約額 ${yen(gmv)}` : ""}`} />
      <div className="no-scrollbar flex gap-1 overflow-x-auto text-[13px] font-semibold">
        {TABS.map((t) => (
          <Link key={t.id} href={t.id ? `/admin/reservations?status=${t.id}` : "/admin/reservations"} className={cn("shrink-0 rounded-full px-3.5 py-1.5", status === t.id ? "bg-ink text-white" : "bg-paper text-ink-2")}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px] text-[13px]">
          <thead className="text-left text-[12px] text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5">予約番号</th>
              <th className="px-3 py-2.5">店舗</th>
              <th className="px-3 py-2.5">商品</th>
              <th className="px-3 py-2.5">ユーザー</th>
              <th className="px-3 py-2.5">受取時間</th>
              <th className="px-3 py-2.5 text-right">金額</th>
              <th className="px-3 py-2.5 text-right">手数料</th>
              <th className="px-3 py-2.5">状態</th>
              <th className="px-4 py-2.5">{status === "completed" ? "成約日時" : "予約日時"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-line last:border-0">
                <td className="tnum px-4 py-2.5 font-semibold tracking-wider">{String(r.code)}</td>
                <td className="px-3 py-2.5">{String(r.store_name)}</td>
                <td className="px-3 py-2.5">{String(r.product_name)}</td>
                <td className="px-3 py-2.5">{String(r.user_name)}</td>
                <td className="tnum px-3 py-2.5">{pickupLabel(String(r.pickup_start_at), String(r.pickup_end_at))}</td>
                <td className="tnum px-3 py-2.5 text-right">{yen(Number(r.total_price))}</td>
                <td className="tnum px-3 py-2.5 text-right">{r.status === "completed" ? yen(Number(r.commission)) : "—"}</td>
                <td className="px-3 py-2.5">
                  <ReservationStatusBadge status={String(r.status)} pickupEndAt={String(r.pickup_end_at)} />
                  {r.cancelled_by === "store" && <span className="ml-1 text-[11px] text-muted">店舗都合</span>}
                </td>
                <td className="tnum px-4 py-2.5 text-[12px]">{dateTime(status === "completed" ? (r.completed_at as string | null) : String(r.created_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
