import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { lineConfigIssues, upsertLineUser, verifyLineIdToken } from "@/server/auth/line";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "@/server/auth/session";
import { asService } from "@/server/db";
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
  if (!env.line.channelId) {
    console.error("[auth] LIFF login not configured", lineConfigIssues().join("; "));
    return NextResponse.json({ ok: false, error: "line_not_configured" }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  // すでにログインしている（例: 管理者のデモログインの直後）なら、自動ログインでセッションを上書きしない
  const currentUserId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (currentUserId) {
    const [exists] = await asService((q) => q.query<{ id: string }>("select id from public.users where id = $1", [currentUserId]));
    if (exists) return NextResponse.json({ ok: true, kept: true });
  }
  try {
    const profile = await verifyLineIdToken(parsed.data.idToken);
    const userId = await upsertLineUser(profile);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, await signSession(userId), sessionCookieOptions);
    return res;
  } catch (error) {
    // 原因の切り分け用（設定の問題があれば一緒に出す。値・トークンは出さない）
    console.error("[auth] LIFF login failed", error instanceof Error ? error.message : "unknown", lineConfigIssues().join("; "));
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
