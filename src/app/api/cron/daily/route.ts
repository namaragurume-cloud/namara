import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDaily } from "@/lib/ops/service";

/**
 * 毎日1回の自動処理（vercel.json の crons から呼ばれます）。
 *  - 回答期限前日・撮影前日・インサイト未提出のリマインド
 *  - 月末（OPS_INSIGHT_DAY）にインサイト提出のお願い
 * Vercel は CRON_SECRET を設定すると Authorization: Bearer <CRON_SECRET> を付けて呼び出します。
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const result = await runDaily();
  const summary = (list: { name: string; result: { ok: boolean } }[]) => ({
    sent: list.filter((x) => x.result.ok).length,
    failed: list.filter((x) => !x.result.ok).map((x) => x.name),
  });
  return NextResponse.json({
    ok: true,
    today: result.today,
    reminders: summary(result.reminders),
    insights: summary(result.insights),
  });
}
