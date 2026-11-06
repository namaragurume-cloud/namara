import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * 管理画面のログイン（パスワード1つ）。
 *   ADMIN_PASSWORD       : ログインパスワード（必須）
 *   ADMIN_SESSION_SECRET : セッション署名用のランダム文字列（推奨。未設定ならパスワードから生成）
 */

const COOKIE = "ops_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 8);
}

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || `pw:${process.env.ADMIN_PASSWORD}`;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function checkPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || !isAdminConfigured()) return false;
  // 長さの違いで比較時間が変わらないよう、ハッシュ同士を比較
  const h = (s: string) => createHmac("sha256", "pw-compare").update(s).digest("hex");
  return safeEqual(h(input), h(pw));
}

export async function startSession(): Promise<void> {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const store = await cookies();
  store.set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  if (!isAdminConfigured()) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) * 1000 > Date.now();
}

/** 管理者でなければログイン画面へ。すべての管理用ページ・サーバーアクションの先頭で呼ぶ */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
