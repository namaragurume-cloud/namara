import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * 店舗QRのトークン: v1.<store_id(32hex)>.<qr_version>.<署名>
 * - store_id をそのまま URL に載せるだけでは他店舗の QR を偽造できてしまうため、HMAC-SHA256 で署名する。
 * - qr_version を上げると（店舗設定の「QRを再発行」）古い印刷物は無効になる。
 */
const PREFIX = "v1";
const UUID_HEX = /^[0-9a-f]{32}$/;

function sign(storeHex: string, version: number) {
  return createHmac("sha256", env.qrSecret).update(`tabetunagu-qr:${PREFIX}:${storeHex}:${version}`).digest("base64url").slice(0, 24);
}

export function createStoreQrToken(storeId: string, version: number) {
  const hex = storeId.replace(/-/g, "").toLowerCase();
  return `${PREFIX}.${hex}.${version}.${sign(hex, version)}`;
}

export function verifyStoreQrToken(token: string): { storeId: string; version: number } | null {
  if (typeof token !== "string" || token.length > 120) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;
  const [, hex, versionRaw, sig] = parts;
  if (!UUID_HEX.test(hex) || !/^\d{1,6}$/.test(versionRaw)) return null;
  const version = Number(versionRaw);
  const expected = Buffer.from(sign(hex, version));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const storeId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return { storeId, version };
}

/** QR に埋め込む URL。LIFF が設定されていれば LINE アプリ内で開く LIFF URL にする。 */
export function storeQrUrl(token: string) {
  const path = `/c/${token}`;
  if (env.line.liffId) return `https://liff.line.me/${env.line.liffId}${path}`;
  return `${env.appUrl}${path}`;
}

export { extractQrToken } from "@/lib/qr-parse";
