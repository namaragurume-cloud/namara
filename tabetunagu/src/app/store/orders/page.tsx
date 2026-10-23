import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { StoreRefundForm } from "@/components/store/StoreRefundForm";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Section";
import type { PickupPhase } from "@/lib/monitor";
import { hhmm, yen } from "@/lib/format";
import { requireStoreMember } from "@/server/auth/viewer";
import { listStoreOrders, maintainStoreOrders } from "@/server/services/pickup";

export const metadata: Metadata = { title: "注文（事前決済）" };

const PHASE_LABEL: Record<PickupPhase, string> = {
  upcoming: "受取予定",
  active: "受取時間中",
  picked_up: "受取済み",
  unclaimed: "未受取",
};

/** 今日の事前決済の注文（旧フローの予約は「予約状況」のまま） */
export default async function StoreOrdersPage() {
  const { viewer, store } = await requireStoreMember("/store/orders");
  await maintainStoreOrders(store.storeId);
  const orders = await listStoreOrders(viewer.id, store.storeId);
  const count = (p: PickupPhase) => orders.filter((o) => o.phase === p).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="注文（事前決済）"
        sub={
          <>
            今日の注文です。受取完了はお客様のスワイプで自動的に反映されます（<Link href="/store/monitor" className="underline">受取モニター</Link>）。
          </>
        }
      />
      <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {(["upcoming", "active", "picked_up", "unclaimed"] as const).map((p) => (
          <div key={p} className="rounded-2xl bg-canvas px-2 py-3">
            <dt className="text-[12px] font-semibold text-muted">{PHASE_LABEL[p]}</dt>
            <dd className="tnum text-[24px] font-bold">{count(p)}</dd>
          </div>
        ))}
      </dl>

      {orders.length === 0 ? (
        <EmptyState title="今日の注文はまだありません" />
      ) : (
        <ul className="space-y-2.5" data-testid="store-orders">
          {orders.map((o) => (
            <li key={o.id} className="card space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold">{o.items.map((i) => `${i.name}×${i.quantity}`).join("・")}</p>
                  <p className="text-[12.5px] text-muted">
                    {o.customerName}・<span className="font-en">#{o.orderNumber}</span>
                  </p>
                </div>
                {o.status === "refunded" ? (
                  <Badge tone="outline">返金済み</Badge>
                ) : (
                  <Badge tone={o.phase === "picked_up" ? "dark" : o.phase === "unclaimed" ? "clay" : "green"}>{PHASE_LABEL[o.phase!]}</Badge>
                )}
              </div>
              <p className="tnum text-[13px] text-ink-2">
                受取 {hhmm(o.pickupStartAt)}〜{hhmm(o.pickupEndAt)}・商品 {yen(o.subtotal)}
                {o.pickedUpAt && `・受取 ${hhmm(o.pickedUpAt)}`}
              </p>
              {o.storeRefundable && <StoreRefundForm storeId={store.storeId} orderId={o.id} orderNumber={o.orderNumber} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
