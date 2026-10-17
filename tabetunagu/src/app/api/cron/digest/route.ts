import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/server/cron";
import { sendEveningDigest } from "@/server/services/notifications";

/** 18:00（JST）の「今夜のTABETUNAGU」まとめ通知 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, result: await sendEveningDigest(null) });
}
