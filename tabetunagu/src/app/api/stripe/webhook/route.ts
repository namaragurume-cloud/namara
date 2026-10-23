import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/server/env";
import { processStripeEvent } from "@/server/services/payments";
import { getStripe } from "@/server/stripe/client";

/**
 * Stripe Webhook。署名を生のリクエストボディで検証してから処理する。
 * - 署名が不正: 400（処理しない）
 * - 同じイベントの再送: 記録済みなら何もせず 200
 * - 処理に失敗: 500（Stripe が再送する）
 */
export async function POST(req: Request) {
  const secret = env.stripe.webhookSecret;
  if (!secret || !env.stripe.enabled) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ ok: false, error: "missing_signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 400 });
  }

  try {
    const result = await processStripeEvent(event);
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    console.error("[stripe webhook] processing failed", event.type, event.id, error);
    return NextResponse.json({ ok: false, error: "processing_failed" }, { status: 500 });
  }
}
