import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { lineAuthorizeUrl, safeNextPath } from "@/server/auth/line";
import { env } from "@/server/env";

/** Web 用 LINE Login の開始（LIFF 外のブラウザ・店舗の PC 等） */
export async function GET(req: NextRequest) {
  if (!env.line.loginEnabled) return NextResponse.redirect(new URL("/login?error=line_not_configured", req.url));
  const next = safeNextPath(req.nextUrl.searchParams.get("next"), "/");
  const state = randomBytes(16).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const res = NextResponse.redirect(lineAuthorizeUrl({ state, nonce, redirectUri: `${env.appUrl}/api/auth/line/callback` }));
  res.cookies.set("tt_line_oauth", JSON.stringify({ state, nonce, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/line",
    maxAge: 600,
  });
  return res;
}
