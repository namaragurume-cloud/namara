import "server-only";
import Stripe from "stripe";
import { AppError } from "@/lib/errors";
import { env } from "../env";

/**
 * Stripe クライアント（サーバー専用・1か所で初期化）。
 * テストでは setStripeForTesting で差し替え、Stripe API に通信しない。
 */
type Holder = { client?: Stripe; key?: string; override?: Stripe };
const holder: Holder = ((globalThis as { __tabetunaguStripe?: Holder }).__tabetunaguStripe ??= {});

export function getStripe(): Stripe {
  if (holder.override) return holder.override;
  const key = env.stripe.secretKey;
  if (!key) throw new AppError("payment_unavailable");
  if (!holder.client || holder.key !== key) {
    holder.client = new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "TABETUNAGU" } });
    holder.key = key;
  }
  return holder.client;
}

/** テスト用: Stripe クライアントを差し替える（undefined で解除） */
export function setStripeForTesting(client: Stripe | undefined) {
  holder.override = client;
}
