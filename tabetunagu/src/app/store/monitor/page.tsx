import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { MonitorBoard } from "@/components/monitor/MonitorBoard";
import { requireStoreMember } from "@/server/auth/viewer";
import { getStoreMonitor, maintainStoreOrders } from "@/server/services/pickup";

export const metadata: Metadata = { title: "受取モニター" };

/**
 * 店舗モニター（事前決済の注文）。お客様が受取完了をスワイプすると数秒で反映され、通知音が鳴る。
 * 店舗の操作は「画面を見て商品を渡す」だけ。
 */
export default async function StoreMonitorPage() {
  const { viewer, store } = await requireStoreMember("/store/monitor");
  await maintainStoreOrders(store.storeId);
  const initial = await getStoreMonitor(viewer.id, store.storeId);
  return (
    <div>
      <PageHeader title="受取モニター" sub="お客様の受取完了は自動で反映されます。画面を確認して商品をお渡しください。" />
      <MonitorBoard initial={initial} />
    </div>
  );
}
