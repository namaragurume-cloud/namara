import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/server/cron";
import { sweepOrdersAndCheckouts } from "@/server/services/payments";
import { markUnclaimedOrders } from "@/server/services/pickup";

/**
 * v2 注文の定期処理（数分ごとの実行を想定。外部スケジューラーからも呼べる）。
 * - 決済期限切れの注文を閉じて在庫を戻し、開いたままの Checkout Session を期限切れにする
 * - 受取終了 + 猶予を過ぎた paid の注文を未受取（unclaimed）にする
 * 店舗モニター・注文画面を開いたときにも店舗単位で同じ処理が走るため、実行間隔が空いても表示はずれない。
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const payments = await sweepOrdersAndCheckouts();
  const unclaimed = await markUnclaimedOrders();
  return NextResponse.json({ ok: true, result: { ...payments, unclaimed_orders: unclaimed } });
}
