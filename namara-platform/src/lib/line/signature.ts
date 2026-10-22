/**
 * LINE Webhook の署名検証。
 * 必ず「生のリクエストボディ（文字列）」に対して検証すること（JSON に変換してからだと一致しない）。
 */
import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/security/identity";

export function computeLineSignature(rawBody: string, channelSecret: string): string {
  return createHmac("sha256", channelSecret).update(rawBody, "utf8").digest("base64");
}

export function verifyLineSignature(rawBody: string, signature: string | null, channelSecret: string): boolean {
  if (!signature || !channelSecret) return false;
  return safeEqual(computeLineSignature(rawBody, channelSecret), signature);
}
