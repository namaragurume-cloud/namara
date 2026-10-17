import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { upsertLineUser, verifyLineIdToken } from "@/server/auth/line";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/server/auth/session";
import { env } from "@/server/env";

const bodySchema = z.object({ idToken: z.string().min(10).max(4096) });

/** LIFF で取得した ID トークンをサーバーで検証してログインする */
export async function POST(req: NextRequest) {
  // 同一オリジンからのみ受け付ける（CSRF 対策）
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && new URL(origin).host !== host) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  if (!env.line.channelId) return NextResponse.json({ ok: false, error: "line_not_configured" }, { status: 503 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    const profile = await verifyLineIdToken(parsed.data.idToken);
    const userId = await upsertLineUser(profile);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, await signSession(userId), sessionCookieOptions);
    return res;
  } catch (error) {
    console.error("[auth] LIFF login failed", error);
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
