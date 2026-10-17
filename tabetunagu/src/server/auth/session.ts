import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { env } from "../env";

/**
 * セッションは署名付き JWT を httpOnly Cookie に保存する（ステートレス）。
 * ロール（店舗メンバー・管理者）は JWT に入れず、毎リクエスト DB から引く（権限変更が即時反映される）。
 */
export const SESSION_COOKIE = "tt_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

function key() {
  return new TextEncoder().encode(env.authSecret);
}

export async function signSession(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer("tabetunagu")
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: "tabetunagu", algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SEC,
};

export async function setSessionCookie(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(userId), sessionCookieOptions);
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSessionUserId() {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}
