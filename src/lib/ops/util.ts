import "server-only";
import { randomBytes } from "node:crypto";

/** URLに使える推測困難なID */
export function newToken(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}

export function shortId(): string {
  return randomBytes(6).toString("base64url");
}

/** 公式LINEに送ってもらう連携コード（紛らわしい文字を除く） */
export function newLinkCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(6);
  return Array.from(buf, (b) => chars[b % chars.length]).join("");
}

export function nowIso(): string {
  return new Date().toISOString();
}
