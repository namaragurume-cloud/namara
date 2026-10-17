import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { cn } from "@/components/ui/cn";
import { ProductStatusBadge } from "@/components/ui/StatusBadge";
import { pickupLabel, yen } from "@/lib/format";
import { listAllProducts } from "@/server/services/admin";

export const metadata: Metadata = { title: "商品" };

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const scope = (await searchParams).scope === "recent" ? "recent" : "live";
  const items = await listAllProducts(scope);
  return (
    <div className="space-y-5">
      <PageHeader
        title="商品"
        action={
          <div className="flex gap-1 text-[13px] font-semibold">
            {[
              { id: "live", label: "受付中・これから" },
              { id: "recent", label: "すべて（新しい順）" },
            ].map((t) => (
              <Link key={t.id} href={`/admin/products?scope=${t.id}`} className={cn("rounded-full px-3.5 py-1.5", scope === t.id ? "bg-ink text-white" : "bg-paper text-ink-2")}>
                {t.label}
              </Link>
            ))}
          </div>
        }
      />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead className="text-left text-[12px] text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5">商品</th>
              <th className="px-3 py-2.5">店舗</th>
              <th className="px-3 py-2.5">受取時間</th>
              <th className="px-3 py-2.5 text-right">価格（通常）</th>
              <th className="px-3 py-2.5 text-right">残数 / 数量</th>
              <th className="px-3 py-2.5 text-right">予約</th>
              <th className="px-4 py-2.5">状態</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={String(p.id)} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-semibold">
                  <Link href={`/products/${p.id}`} className="hover:underline">
                    {String(p.name)}
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  {String(p.store_name)}
                  {p.store_status !== "active" && <span className="ml-1 text-[11px] text-clay">（{String(p.store_status)}）</span>}
                </td>
                <td className="tnum px-3 py-2.5">{pickupLabel(String(p.pickup_start_at), String(p.pickup_end_at))}</td>
                <td className="tnum px-3 py-2.5 text-right">
                  {yen(Number(p.rescue_price))}
                  <span className="ml-1 text-[11px] text-muted">（{yen(Number(p.original_price))}）</span>
                </td>
                <td className="tnum px-3 py-2.5 text-right">
                  {String(p.remaining_quantity)} / {String(p.quantity)}
                </td>
                <td className="tnum px-3 py-2.5 text-right">{String(p.reserved)}</td>
                <td className="px-4 py-2.5">
                  <ProductStatusBadge status={String(p.status)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
