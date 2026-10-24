import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/server/cron";
import { env } from "@/server/env";
import { runFeaturedDigest } from "@/server/services/line-digest";

/**
 * 18:00（JST）の日次注目商品通知「今夜の食べつなぎ」（vercel.json: 0 9 * * * UTC）。
 * ENABLE_LINE_DIGEST_CRON=true でなければ何もしない（既定）。有効でも、ENABLE_LINE_DIGEST_SEND=true でなければ dry run。
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!env.line.digestCronEnabled) return NextResponse.json({ ok: true, skipped: "cron_disabled" });
  return NextResponse.json({ ok: true, result: await runFeaturedDigest() });
}
