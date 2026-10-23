import type { Metadata } from "next";
import Link from "next/link";
import { productStatusAction } from "@/app/actions/store";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/Section";
import { ProductStatusBadge } from "@/components/ui/StatusBadge";
import { pickupLabel, yen } from "@/lib/format";
import { requireStoreMember } from "@/server/auth/viewer";
import { listStoreProducts } from "@/server/services/store";

export const metadata: Metadata = { title: "出品商品" };

export default async function StoreProductsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const { scope: raw } = await searchParams;
  const scope = raw === "past" ? "past" : "active";
  const { viewer, store } = await requireStoreMember("/store/products");
  const items = await listStoreProducts(viewer.id, store.storeId, scope);
  return (
    <div>
      <PageHeader title="出品商品" action={<ButtonLink href="/store/products/new">出品する</ButtonLink>} />
      <div className="mb-4 flex gap-1 text-[13px] font-semibold">
        {[
          { id: "active", label: "受付中・これから" },
          { id: "past", label: "過去の出品" },
        ].map((t) => (
          <Link key={t.id} href={`/store/products?scope=${t.id}`} className={cn("rounded-full px-4 py-2", scope === t.id ? "bg-ink text-white" : "bg-paper text-ink-2")}>
            {t.label}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState title={scope === "active" ? "受付中の出品はありません" : "過去の出品はありません"} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead className="text-left text-[12px] text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-semibold">商品</th>
                <th className="px-3 py-2.5 font-semibold">受取時間</th>
                <th className="px-3 py-2.5 text-right font-semibold">価格</th>
                <th className="px-3 py-2.5 text-right font-semibold">残数 / 数量</th>
                <th className="px-3 py-2.5 text-right font-semibold">完了</th>
                <th className="px-3 py-2.5 font-semibold">状態</th>
                <th className="px-4 py-2.5 text-right font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/store/products/${p.id}`} className="font-semibold hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="tnum px-3 py-3">{pickupLabel(p.pickupStartAt, p.pickupEndAt)}</td>
                  <td className="tnum px-3 py-3 text-right">{yen(p.rescuePrice)}</td>
                  <td className="tnum px-3 py-3 text-right">
                    {p.remaining} / {p.quantity}
                  </td>
                  <td className="tnum px-3 py-3 text-right">{p.completedCount}</td>
                  <td className="px-3 py-3">
                    <ProductStatusBadge status={p.status} pickupEndAt={p.pickupEndAt} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {scope === "active" && (p.status === "published" || p.status === "sold_out") && (
                        <form action={productStatusAction}>
                          <input type="hidden" name="storeId" value={store.storeId} />
                          <input type="hidden" name="productId" value={p.id} />
                          <input type="hidden" name="status" value="closed" />
                          <button className="rounded-full border border-line px-3 py-1 text-[12px] font-semibold hover:bg-canvas">受付停止</button>
                        </form>
                      )}
                      {scope === "active" && p.status === "closed" && (
                        <form action={productStatusAction}>
                          <input type="hidden" name="storeId" value={store.storeId} />
                          <input type="hidden" name="productId" value={p.id} />
                          <input type="hidden" name="status" value="published" />
                          <button className="rounded-full border border-line px-3 py-1 text-[12px] font-semibold hover:bg-canvas">再開</button>
                        </form>
                      )}
                      <Link href={`/store/products/new?from=${p.id}`} className="rounded-full border border-line px-3 py-1 text-[12px] font-semibold hover:bg-canvas">
                        再出品
                      </Link>
                    </div>
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
