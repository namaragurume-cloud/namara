"use client";

import { Minus, Plus } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import { purchaseAction, resumeCheckoutAction } from "@/app/actions/payments";
import { buyLabel, priceBreakdown } from "@/lib/purchase";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

/**
 * v2 購入確認（事前決済）のフォーム。
 * 表示する金額は目安。送るのは商品と数量だけで、注文の金額はサーバーが注文を作成して確定する（フロントの合計は使わない）。
 * つなぐチャージは1注文ごと（数量によらず一定）。ポイントはお支払い完了後に付与。
 * 商品の確認・受取情報・ご確認事項はサーバーで描画したものを差し込む（数量と内訳だけがこのフォームで変わる）。
 */
export function BuyForm({
  productId,
  unitPrice,
  tsunaguCharge,
  orderPoints,
  max,
  unit,
  pickup,
  details,
}: {
  productId: string;
  unitPrice: number;
  tsunaguCharge: number;
  orderPoints: number;
  max: number;
  unit: string;
  pickup: ReactNode;
  details: ReactNode;
}) {
  const [state, action] = useActionState(purchaseAction, null);
  const [qty, setQty] = useState(1);
  const b = priceBreakdown(unitPrice, tsunaguCharge, orderPoints, qty);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="quantity" value={qty} />
      {max > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-line px-4 py-2.5">
          <span className="text-[14px] font-semibold" id="qty-label">
            数量
          </span>
          <div className="flex items-center gap-3" role="group" aria-labelledby="qty-label">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label="数量を減らす"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line disabled:opacity-40"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <span className="tnum w-12 text-center text-[17px] font-semibold" aria-live="polite" data-testid="buy-quantity">
              {qty}
              <span className="text-[11px]">{unit}</span>
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(max, q + 1))}
              disabled={qty >= max}
              aria-label="数量を増やす"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {pickup}

      <PaymentSummary subtotal={b.subtotal} tsunaguCharge={b.tsunaguCharge} total={b.total} points={b.points} />

      {details}

      {state && !state.ok && (
        <div role="alert" data-testid="buy-error">
          <Notice tone="error">{state.message}</Notice>
        </div>
      )}

      <StickyBar>
        <SubmitButton size="lg" className="w-full" pendingLabel="決済画面を開いています…" data-testid="buy-submit">
          {buyLabel(b.total)}
        </SubmitButton>
      </StickyBar>
    </form>
  );
}

/** 支払いの内訳（お支払い合計をいちばん大きく）とポイント */
export function PaymentSummary({ subtotal, tsunaguCharge, total, points }: { subtotal: number; tsunaguCharge: number; total: number; points: number }) {
  return (
    <section className="rounded-2xl bg-canvas px-4 py-4" aria-labelledby="payment-title">
      <h2 id="payment-title" className="mb-2 text-[13px] font-bold text-muted">
        お支払い
      </h2>
      <dl className="tnum space-y-2 text-[14px]" data-testid="buy-summary">
        <div className="flex justify-between">
          <dt className="text-ink-2">商品小計</dt>
          <dd>{subtotal.toLocaleString("ja-JP")}円</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-2">つなぐチャージ</dt>
          <dd>{tsunaguCharge.toLocaleString("ja-JP")}円</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-2.5">
          <dt className="font-bold">お支払い合計</dt>
          <dd className="text-[26px] font-bold leading-none">
            {total.toLocaleString("ja-JP")}
            <span className="ml-0.5 text-[13px]">円</span>
          </dd>
        </div>
      </dl>
      <p className="mt-2.5 text-[12px] leading-relaxed text-muted">つなぐチャージは、TABETUNAGUのサービス利用料です（1回のご注文ごと）。</p>
      <p className="mt-1 text-[12px] font-semibold text-forest" data-testid="points-note">
        お支払い完了後、この注文で{points}ptを付与します。
      </p>
      <p className="mt-1 text-[12px] text-ink-2" data-testid="payment-method">
        お支払いはオンラインで完了します。店頭でのお会計はありません。
      </p>
    </section>
  );
}

/** 画面下に固定する購入ボタンの枠（購入確認では下部ナビを出さないため、画面の最下部に置く） */
export function StickyBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      data-testid="buy-sticky"
    >
      <div className="mx-auto max-w-xl px-4 py-3">{children}</div>
    </div>
  );
}

/** 決済待ちの注文の決済を再開する（新しい注文は作らない） */
export function ResumeCheckoutForm({ orderId, total }: { orderId: string; total: number }) {
  const [state, action] = useActionState(resumeCheckoutAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="orderId" value={orderId} />
      {state && !state.ok && (
        <div role="alert" className="mb-3" data-testid="buy-error">
          <Notice tone="error">{state.message}</Notice>
        </div>
      )}
      <StickyBar>
        <SubmitButton size="lg" className="w-full" pendingLabel="決済画面を開いています…" data-testid="buy-resume">
          決済を続ける（{total.toLocaleString("ja-JP")}円）
        </SubmitButton>
      </StickyBar>
    </form>
  );
}
