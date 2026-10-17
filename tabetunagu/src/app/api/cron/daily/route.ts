import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/server/cron";
import { runAutoRelist, runSweep } from "@/server/services/admin";

/** 毎朝: 前日分の締め（No Show 判定）と STANDARD の自動再出品 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const sweep = await runSweep();
  const relisted = await runAutoRelist();
  return NextResponse.json({ ok: true, sweep, relisted });
}
