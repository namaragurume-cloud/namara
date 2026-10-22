import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { recordEvent } from "@/lib/server/services/search-service";

/**
 * 計測付きリダイレクト（詳細・地図・予約リンク）。
 * 遷移先はクエリではなくサーバー側の店舗データから決める（オープンリダイレクト防止）。
 */
const querySchema = z.object({
  t: z.enum(["detail", "map", "reservation"]),
  s: z.string().min(1).max(100),
  store: z.string().min(1).max(50),
  pos: z.coerce.number().int().min(0).max(10),
});

const EVENT_TYPE = { detail: "store_detail_clicked", map: "map_clicked", reservation: "reservation_link_clicked" } as const;

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.redirect(new URL("/ai", request.url));
  const { t, s, store: storeId, pos } = parsed.data;

  const db = getDb();
  const store = db.stores.find((x) => x.id === storeId && x.published);
  if (!store) return NextResponse.redirect(new URL("/ai", request.url));

  // 検索結果に実際に出した店舗のクリックだけを数える（同じ検索・同じ店舗・同じ種類は1回まで）
  const log = db.searchLogs.find((l) => l.id === s);
  if (log && log.shownStoreIds.includes(storeId)) {
    recordEvent(db, { type: EVENT_TYPE[t], channel: log.channel, sessionId: log.sessionId, searchId: s, storeId, position: pos, dedupeKey: `${t}:${s}:${storeId}` });
  }

  if (t === "map") {
    const { lat, lng } = store.location;
    return NextResponse.redirect(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  }
  if (t === "reservation" && store.reservationUrl) return NextResponse.redirect(store.reservationUrl);
  return NextResponse.redirect(new URL(`/ai/stores/${store.id}?s=${encodeURIComponent(s)}`, request.url));
}
