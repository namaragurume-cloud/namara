import type { Metadata } from "next";
import Link from "next/link";
import { generateBillingAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/ActionButton";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Section";
import { yen } from "@/lib/format";
import { jstMonthRange } from "@/lib/time";
import { listBilling } from "@/server/services/admin";
import { requireAdmin } from "@/server/auth/viewer";

export const metadata: Metadata = { title: "請求" };

function shift(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function AdminBillingPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin("/admin/billing");
  const month = jstMonthRange((await searchParams).month).month;
  const rows = await listBilling(month);
  const total = rows.reduce((s, r) => s + r.total_amount, 0);
  return (
    <div className="space-y-5">
      <PageHeader
        title="請求（TABETUNAGU 手数料）"
        sub="店舗への商品代金の入金処理はありません。店舗に請求する月額と成約手数料の集計です。"
        action={
          <div className="flex items-center gap-1 text-[13px] font-semibold">
            <Link href={`/admin/billing?month=${shift(month, -1)}`} className="rounded-full border border-line bg-paper px-3 py-1.5">
              前月
            </Link>
            <span className="tnum px-2">{month}</span>
            <Link href={`/admin/billing?month=${shift(month, 1)}`} className="rounded-full border border-line bg-paper px-3 py-1.5">
              翌月
            </Link>
          </div>
        }
      />
      <ActionForm action={generateBillingAction} submitLabel={`${month} の請求データを作成・更新`} className="flex flex-wrap items-start gap-3">
        <input type="hidden" name="month" value={month} />
      </ActionForm>
      {rows.length === 0 ? (
        <EmptyState title="この月の請求データはまだありません" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead className="text-left text-[12px] text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5">店舗</th>
                <th className="px-3 py-2.5">プラン</th>
                <th className="px-3 py-2.5 text-right">成約件数</th>
                <th className="px-3 py-2.5 text-right">成約額</th>
                <th className="px-3 py-2.5 text-right">月額</th>
                <th className="px-3 py-2.5 text-right">成約手数料</th>
                <th className="px-3 py-2.5 text-right">請求額</th>
                <th className="px-4 py-2.5">状態</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.store_name} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-semibold">{r.store_name}</td>
                  <td className="px-3 py-2.5">{r.plan_code.toUpperCase()}</td>
                  <td className="tnum px-3 py-2.5 text-right">{r.completed_count}</td>
                  <td className="tnum px-3 py-2.5 text-right">{yen(r.gmv)}</td>
                  <td className="tnum px-3 py-2.5 text-right">{yen(r.monthly_fee)}</td>
                  <td className="tnum px-3 py-2.5 text-right">{yen(r.commission_amount)}</td>
                  <td className="tnum px-3 py-2.5 text-right font-semibold">{yen(r.total_amount)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={r.status === "paid" ? "green" : "sand"}>{r.status}</Badge>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="px-4 py-3 font-bold" colSpan={6}>
                  合計
                </td>
                <td className="tnum px-3 py-3 text-right font-bold">{yen(total)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
