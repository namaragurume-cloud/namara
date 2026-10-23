import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { getViewer } from "@/server/auth/viewer";
import { getStoreMonitor, maintainStoreOrders } from "@/server/services/pickup";

/**
 * 店舗モニターの軽量ポーリング用 API。
 * ?store=<店舗ID>&v=<前回の version> … 変化がなければ { unchanged: true } だけを返す。
 */
export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const url = new URL(req.url);
  const storeId = url.searchParams.get("store") ?? "";
  if (!viewer.memberships.some((m) => m.storeId === storeId)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  try {
    await maintainStoreOrders(storeId);
    const snapshot = await getStoreMonitor(viewer.id, storeId);
    const headers = { "Cache-Control": "no-store" };
    if (url.searchParams.get("v") === snapshot.version) {
      return NextResponse.json({ ok: true, unchanged: true, version: snapshot.version }, { headers });
    }
    return NextResponse.json({ ok: true, snapshot }, { headers });
  } catch (error) {
    if (error instanceof AppError && error.code === "forbidden") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    console.error("[monitor] failed", error);
    return NextResponse.json({ ok: false, error: "unknown" }, { status: 500 });
  }
}
