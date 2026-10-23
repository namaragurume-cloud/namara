import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/Section";
import { pickupLabel, yen } from "@/lib/format";
import { requireViewer } from "@/server/auth/viewer";
import { listMyOrders, type MyOrderTab } from "@/server/services/pickup";

export const metadata: Metadata = { title: "注文履歴" };

const TABS: { id: MyOrderTab; label: string; empty: string }[] = [
  { id: "ready", label: "受取待ち", empty: "受取待ちの注文はありません" },
  { id: "pending", label: "支払い待ち", empty: "お支払い待ちの注文はありません" },
  { id: "picked_up", label: "受取済み", empty: "受取済みの注文はありません" },
  { id: "unclaimed", label: "未受取", empty: "未受取の注文はありません" },
  { id: "refunded", label: "返金済み", empty: "返金済みの注文はありません" },
  { id: "cancelled", label: "キャンセル", empty: "キャンセルした注文はありません" },
];

/** v2（事前決済）の注文履歴。旧フローの予約は /reservations のまま */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab = TABS.find((t) => t.id === rawTab) ?? TABS[0];
  const viewer = await requireViewer("/orders");
  const items = await listMyOrders(viewer.id, tab.id);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-[20px] font-bold">注文履歴</h1>
        <Link href="/reservations" className="text-[12.5px] font-semibold text-forest underline-offset-2 hover:underline">
          予約（店頭払い）はこちら
        </Link>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 text-[12.5px] font-semibold" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/orders?tab=${t.id}`}
            role="tab"
            aria-selected={tab.id === t.id}
            className={cn("shrink-0 rounded-full px-3.5 py-2", tab.id === t.id ? "bg-ink text-white" : "bg-canvas text-muted")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title={tab.empty} action={tab.id === "ready" ? <ButtonLink href="/products">商品をさがす</ButtonLink> : undefined} />
      ) : (
        <ul className="space-y-2.5">
          {items.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="block rounded-2xl border border-line p-3 hover:bg-canvas">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[12px] text-muted">{o.storeName}</p>
                  <p className="font-en shrink-0 text-[12px] text-muted">#{o.orderNumber}</p>
                </div>
                <p className="truncate text-[14px] font-bold">{o.itemsLabel}</p>
                <p className="tnum mt-0.5 text-[12px] text-ink-2">
                  {pickupLabel(o.pickupStartAt, o.pickupEndAt)}・{yen(o.total)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
