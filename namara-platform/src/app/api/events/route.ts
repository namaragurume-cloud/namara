import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { getConsumerSessionId } from "@/lib/server/consumer-session";
import { recordEvent, wasShownInSearch } from "@/lib/server/services/search-service";
import { limiter } from "@/lib/security/rate-limit";

/** クライアントから直接送れるのは「保存」だけ。表示・クリックはサーバー側で記録する */
const bodySchema = z.object({
  type: z.literal("store_saved"),
  searchId: z.string().min(1).max(100),
  storeId: z.string().min(1).max(50),
  dedupeKey: z.string().uuid(),
});

export async function POST(request: Request) {
  const sessionId = await getConsumerSessionId();
  if (!sessionId) return NextResponse.json({ error: "session required" }, { status: 401 });
  if (!limiter("event", 60, 60_000).check(sessionId).allowed) return NextResponse.json({ error: "too many requests" }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid event" }, { status: 400 });

  const db = getDb();
  const { searchId, storeId, dedupeKey, type } = parsed.data;
  if (!wasShownInSearch(db, searchId, storeId, sessionId)) {
    return NextResponse.json({ error: "unknown search result" }, { status: 400 });
  }
  const recorded = recordEvent(db, { type, channel: "web", sessionId, searchId, storeId, dedupeKey: `web:${dedupeKey}` });
  return NextResponse.json({ recorded });
}
