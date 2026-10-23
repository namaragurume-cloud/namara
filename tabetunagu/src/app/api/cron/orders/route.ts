import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/server/cron";
import { ORDER_MAINTENANCE_KEY, recordHeartbeat } from "@/server/services/ops";
import { sweepOrdersAndCheckouts } from "@/server/services/payments";
import { markUnclaimedOrders } from "@/server/services/pickup";

/**
 * v2 注文の定期処理（5分ごとの実行を想定。外部スケジューラーからも呼べる）。
 * - 決済期限切れの注文を閉じて在庫を戻し、開いたままの Checkout Session を期限切れにする
 * - 受取終了 + 猶予を過ぎた paid の注文を未受取（unclaimed）にする
 * - 正常に終わったら最終実行時刻を記録する（管理画面「PoC 公開準備」で監視）
 * CRON_SECRET が未設定の環境では常に 401（Authorization: Bearer <CRON_SECRET> が必須）。
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const payments = await sweepOrdersAndCheckouts();
  const unclaimed = await markUnclaimedOrders();
  const result = { ...payments, unclaimed_orders: unclaimed };
  await recordHeartbeat(ORDER_MAINTENANCE_KEY, result);
  return NextResponse.json({ ok: true, result });
}
