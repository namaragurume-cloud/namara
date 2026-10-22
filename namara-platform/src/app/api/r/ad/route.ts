import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { recordAdClick } from "@/lib/server/services/ad-service";
import { getConsumerSessionId } from "@/lib/server/consumer-session";
import { limiter } from "@/lib/security/rate-limit";

/** スポンサー枠のクリック。クリック記録と課金計算イベントは ad-service で分けて記録する */
export async function GET(request: NextRequest) {
  const parsed = z.string().min(1).max(100).safeParse(request.nextUrl.searchParams.get("imp"));
  if (!parsed.success) return NextResponse.redirect(new URL("/ai", request.url));

  const db = getDb();
  const impression = db.impressions.find((i) => i.id === parsed.data);
  // Web は Cookie のセッション、LINE 内ブラウザは表示時のセッションで照合する
  const sessionId = (await getConsumerSessionId()) ?? impression?.sessionId ?? "unknown";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!limiter("ad_click", 20, 60_000).check(`ip:${ip}`).allowed) {
    return NextResponse.redirect(new URL("/ai", request.url));
  }

  const { storeId } = recordAdClick({ impressionId: parsed.data, sessionId }, db);
  if (!storeId) return NextResponse.redirect(new URL("/ai", request.url));
  return NextResponse.redirect(new URL(`/ai/stores/${storeId}?ad=1`, request.url));
}
