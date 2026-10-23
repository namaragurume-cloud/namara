import type { Metadata } from "next";
import { MonitorBoard } from "@/components/monitor/MonitorBoard";
import { requireStoreMember } from "@/server/auth/viewer";
import { logEvent } from "@/server/services/events";
import { getStoreMonitor, maintainStoreOrders } from "@/server/services/pickup";

export const metadata: Metadata = { title: "受取モニター" };

/**
 * 店舗モニター（事前決済の注文）。お客様が受取完了をスワイプすると数秒で反映され、通知音が鳴る。
 * 店舗の操作は「画面を見て商品を渡す」だけ。
 */
export default async function StoreMonitorPage() {
  const { viewer, store } = await requireStoreMember("/store/monitor");
  await maintainStoreOrders(store.storeId);
  const initial = await getStoreMonitor(viewer.id, store.storeId, new Date());
  await logEvent("monitor_opened", { userId: viewer.id, storeId: store.storeId });
  return <MonitorBoard initial={initial} />;
}
