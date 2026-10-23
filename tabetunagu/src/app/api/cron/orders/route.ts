import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/server/cron";
import { sweepOrdersAndCheckouts } from "@/server/services/payments";

/** 決済期限切れの注文を閉じて在庫を戻し、開いたままの Checkout Session を期限切れにする（数分ごとの実行を想定） */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, result: await sweepOrdersAndCheckouts() });
}
