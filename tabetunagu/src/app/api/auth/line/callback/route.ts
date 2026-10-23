import { NextResponse, type NextRequest } from "next/server";
import { exchangeLineCode, safeNextPath, upsertLineUser, verifyLineIdToken } from "@/server/auth/line";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/server/auth/session";
import { env } from "@/server/env";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  let saved: { state: string; nonce: string; next: string } | null = null;
  try {
    saved = JSON.parse(req.cookies.get("tt_line_oauth")?.value ?? "null");
  } catch {
    saved = null;
  }
  // 失敗・キャンセル（LINE の同意画面で「キャンセル」）でも、もう一度ログインすれば元の画面へ戻れるよう next を残す
  const fail = (errorCode = "login_failed") => {
    const next = safeNextPath(saved?.next, "/");
    const url = new URL("/login", env.appUrl);
    url.searchParams.set("error", errorCode);
    if (next !== "/") url.searchParams.set("next", next);
    const res = NextResponse.redirect(url);
    res.cookies.delete({ name: "tt_line_oauth", path: "/api/auth/line" });
    return res;
  };
  // state 検証（CSRF 対策）
  if (!code || !state || !saved || saved.state !== state) return fail();
  try {
    const idToken = await exchangeLineCode(code, `${env.appUrl}/api/auth/line/callback`);
    const profile = await verifyLineIdToken(idToken, saved.nonce);
    const userId = await upsertLineUser(profile);
    const res = NextResponse.redirect(new URL(safeNextPath(saved.next, "/"), env.appUrl));
    res.cookies.set(SESSION_COOKIE, await signSession(userId), sessionCookieOptions);
    res.cookies.delete({ name: "tt_line_oauth", path: "/api/auth/line" });
    return res;
  } catch (error) {
    console.error("[auth] LINE callback failed", error);
    return fail();
  }
}
