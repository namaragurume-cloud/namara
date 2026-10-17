import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/server/cron";
import { runSweep } from "@/server/services/admin";

/** 受取時間を過ぎた予約を no_show / expired に、商品を受付終了にする */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, result: await runSweep() });
}
