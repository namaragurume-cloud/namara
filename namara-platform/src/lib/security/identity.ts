/**
 * 利用者識別子の保護。
 *
 * LINE の userId などは生のまま保存・ログ出力しない。
 * サーバーだけが知る秘密鍵（IDENTITY_HASH_SECRET）で HMAC を取った値を保存する。
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const DEV_FALLBACK_SECRET = "dev-only-identity-secret-do-not-use-in-production";

function identitySecret(): string {
  const secret = process.env.IDENTITY_HASH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production" && process.env.NAMARA_DEMO_MODE !== "1") {
    throw new Error("IDENTITY_HASH_SECRET（32文字以上）が設定されていません");
  }
  return DEV_FALLBACK_SECRET;
}

export function hashIdentifier(kind: "line" | "web", rawId: string): string {
  return createHmac("sha256", identitySecret()).update(`${kind}:${rawId}`).digest("hex");
}

/** ログに出してよい形に伏せる（先頭4文字だけ残す） */
export function maskIdentifier(rawId: string): string {
  return rawId.length <= 4 ? "****" : `${rawId.slice(0, 4)}****`;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
