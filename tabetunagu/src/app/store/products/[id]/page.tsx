import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { productStatusAction } from "@/app/actions/store";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { ProductEditForm } from "@/components/store/ProductEditForm";
import { features } from "@/lib/features";
import { ButtonLink } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Section";
import { ProductStatusBadge } from "@/components/ui/StatusBadge";
import { pickupLabel } from "@/lib/format";
import { requireStoreMember } from "@/server/auth/viewer";
import { getStoreProduct } from "@/server/services/store";
import { nowMs } from "@/lib/clock";

export const metadata: Metadata = { title: "出品の管理" };

export default async function StoreProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { viewer, store } = await requireStoreMember(`/store/products/${id}`);
  const p = await getStoreProduct(viewer.id, store.storeId, id);
  if (!p) notFound();
  const live = Date.parse(p.pickupEndAt) > nowMs();
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={p.name}
        sub={
          <span className="flex items-center gap-2">
            <ProductStatusBadge status={p.status} pickupEndAt={p.pickupEndAt} />
            <span className="tnum">{pickupLabel(p.pickupStartAt, p.pickupEndAt)}</span>
          </span>
        }
        action={
          <div className="flex gap-2">
            {live && (p.status === "published" || p.status === "sold_out" || p.status === "closed") && (
              <form action={productStatusAction}>
                <input type="hidden" name="storeId" value={store.storeId} />
                <input type="hidden" name="productId" value={p.id} />
                <input type="hidden" name="status" value={p.status === "closed" ? "published" : "closed"} />
                <button className="h-11 rounded-full border border-line bg-paper px-5 text-[14px] font-semibold">
                  {p.status === "closed" ? "受付を再開" : "受付を停止"}
                </button>
              </form>
            )}
            <ButtonLink href={`/store/products/new?from=${p.id}`} variant="secondary">
              この内容で再出品
            </ButtonLink>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="残数" value={`${p.remaining} / ${p.quantity}`} />
        <Stat label="来店待ち" value={`${p.activeCount}件`} />
        <Stat label="食べつなぎ完了" value={`${p.completedCount}件`} />
        <Stat label="キャンセル" value={`${p.cancelledCount}件`} />
      </div>
      <div className="card p-5">
        <ProductEditForm storeId={store.storeId} product={p} reserved={p.quantity - p.remaining} v2={features.v2Journey} />
      </div>
      <Link href="/store/products" className="text-[13px] font-semibold text-forest">
        ← 出品商品へ
      </Link>
    </div>
  );
}
