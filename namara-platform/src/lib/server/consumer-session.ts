/**
 * 消費者（Web版なまらAI）の仮名セッション。
 * ランダムなIDを httpOnly Cookie に入れるだけで、氏名・メール等の個人情報は扱わない。
 */
import "server-only";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "namara_sid";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function getConsumerSessionId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  return value && /^web:[0-9a-f-]{36}$/.test(value) ? value : null;
}

export async function getOrCreateConsumerSessionId(): Promise<string> {
  const existing = await getConsumerSessionId();
  if (existing) return existing;
  const id = `web:${crypto.randomUUID()}`;
  const store = await cookies();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return id;
}

export async function clearConsumerSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
