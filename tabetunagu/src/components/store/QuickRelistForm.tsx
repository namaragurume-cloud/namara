"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { quickRelistAction } from "@/app/actions/store";
import { ProductVisual } from "@/components/product/ProductVisual";
import { buttonClass } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Section";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { discountOf } from "@/lib/deals";
import { quickPickupLabel } from "@/lib/quick-relist";

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

export type QuickRelistSourceView = {
  id: string;
  name: string;
  imageUrl: string | null;
  category: string;
  isBox: boolean;
  rescuePrice: number;
  originalPrice: number;
  previousQuantity: number;
  previousStart: string;
  previousEnd: string;
};

/**
 * かんたん出品の入力画面（スマホ優先）。商品名・画像・価格は前回の内容。数量と受取時間は今回入力する（前回の値は自動で入れない。ボタンで入れられる）。
 * 出品ボタンの直前に「商品名・価格・数量・受取時間」だけを確認として表示する。
 */
export function QuickRelistForm({ storeId, source, today, tomorrow, nowIso }: { storeId: string; source: QuickRelistSourceView; today: string; tomorrow: string; nowIso: string }) {
  const [state, action] = useActionState(quickRelistAction, null);
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [rescue, setRescue] = useState(String(source.rescuePrice));
  const [original, setOriginal] = useState(String(source.originalPrice));

  const unit = source.isBox ? "BOX" : "個";
  const rescueNum = Number(rescue);
  const originalNum = Number(original);
  const discount = discountOf(originalNum, rescueNum);
  const priceChanged = rescueNum !== source.rescuePrice || originalNum !== source.originalPrice;
  const pickup = quickPickupLabel(date, start, end, new Date(nowIso));
  const qty = Number(quantity);
  const ready = Number.isInteger(qty) && qty >= 1 && qty <= 999 && Boolean(pickup) && start !== end && rescueNum >= 1 && rescueNum <= originalNum;
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok) {
    const productId = String(state.data?.productId ?? "");
    return (
      <section className="card space-y-4 p-5 text-center" data-testid="quick-relist-done">
        <CircleCheck className="mx-auto h-12 w-12 text-forest" aria-hidden />
        <h2 className="text-[22px] font-bold">出品しました！</h2>
        <p className="text-[14px] text-ink-2" data-testid="quick-relist-done-summary">
          {source.name}・公開中・残り{qty}
          {unit}・{pickup}
        </p>
        <div className="grid gap-2">
          <Link href={`/products/${productId}`} className={buttonClass("primary", "lg", "w-full")} data-testid="quick-relist-view">
            商品を見る
          </Link>
          <Link href="/store/products/quick" className={buttonClass("secondary", "lg", "w-full")} data-testid="quick-relist-again">
            もう1商品出品する
          </Link>
          <Link href="/store" className="py-2 text-[13px] font-semibold text-forest">
            ダッシュボードへ
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form action={action} className="space-y-5" data-testid="quick-relist-form">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="sourceId" value={source.id} />
      <input type="hidden" name="pickupDate" value={date} />
      <input type="hidden" name="rescuePrice" value={priceChanged ? rescue : ""} />
      <input type="hidden" name="originalPrice" value={priceChanged ? original : ""} />

      <section className="card flex gap-4 p-4" data-testid="quick-relist-product">
        <ProductVisual imageUrl={source.imageUrl} category={source.category} alt="" sizes="96px" className="h-24 w-24 shrink-0 rounded-2xl" />
        <div className="min-w-0">
          <p className="text-[16px] font-bold leading-snug" data-testid="quick-relist-name">
            {source.name}
          </p>
          <p className="tnum mt-1 text-[22px] font-bold leading-none" data-testid="quick-relist-price">
            {yen(rescueNum || 0)}
          </p>
          <p className="tnum mt-1 text-[13px] text-ink-2">
            <span data-testid="quick-relist-original">{yen(originalNum || 0)}相当</span>
            {discount && <span className="ml-2 font-bold text-forest">{discount.rate}%OFF</span>}
          </p>
        </div>
      </section>

      <div>
        <label htmlFor="quantity" className="label">
          数量
        </label>
        <div className="flex items-center gap-2">
          <input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="field tnum h-14 w-28 text-center text-[22px] font-bold"
            placeholder="0"
            data-testid="quick-relist-quantity"
          />
          <span className="text-[15px] font-semibold">{unit}</span>
          <button type="button" onClick={() => setQuantity(String(source.previousQuantity))} className="ml-auto rounded-full border border-line px-3 py-2 text-[12.5px] font-semibold text-ink-2">
            前回 {source.previousQuantity}
            {unit}
          </button>
        </div>
        {errors?.quantity && <p className="mt-1 text-[12px] text-clay">{errors.quantity}</p>}
      </div>

      <fieldset>
        <legend className="label">受取時間</legend>
        <div className="mb-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="受取日">
          {[
            { value: today, label: "今日" },
            { value: tomorrow, label: "明日" },
          ].map((d) => (
            <button
              key={d.value}
              type="button"
              role="radio"
              aria-checked={date === d.value}
              onClick={() => setDate(d.value)}
              className={`h-10 rounded-full border text-[14px] font-semibold ${date === d.value ? "border-forest bg-leaf-soft text-forest" : "border-line text-ink-2"}`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <input
            aria-label="受取開始"
            name="pickupStart"
            type="time"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="field tnum h-14 min-w-0 text-center text-[18px] font-bold"
            data-testid="quick-relist-start"
          />
          <span aria-hidden>〜</span>
          <input
            aria-label="受取終了"
            name="pickupEnd"
            type="time"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="field tnum h-14 min-w-0 text-center text-[18px] font-bold"
            data-testid="quick-relist-end"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setStart(source.previousStart);
            setEnd(source.previousEnd);
          }}
          className="mt-2 rounded-full border border-line px-3 py-2 text-[12.5px] font-semibold text-ink-2"
          data-testid="quick-relist-previous-time"
        >
          前回と同じ時間（{source.previousStart}〜{source.previousEnd}）
        </button>
        {start && end && start >= end && start !== end && <p className="mt-1 text-[12px] text-ink-2">終了が開始より前のため、翌日の{end}までとして出品します。</p>}
        {(errors?.pickupStart || errors?.pickupEnd) && <p className="mt-1 text-[12px] text-clay">{errors.pickupStart ?? errors.pickupEnd}</p>}
      </fieldset>

      <details className="rounded-2xl border border-line">
        <summary className="flex min-h-[44px] cursor-pointer items-center px-4 text-[13.5px] font-semibold text-ink-2">価格を変更する（任意）</summary>
        <div className="grid grid-cols-2 gap-3 border-t border-line p-4">
          <div>
            <label htmlFor="rescue" className="label">
              販売価格（円）
            </label>
            <input id="rescue" type="number" inputMode="numeric" min={1} value={rescue} onChange={(e) => setRescue(e.target.value)} className="field tnum" data-testid="quick-relist-rescue" />
          </div>
          <div>
            <label htmlFor="original" className="label">
              参考価格（円）
            </label>
            <input id="original" type="number" inputMode="numeric" min={1} value={original} onChange={(e) => setOriginal(e.target.value)} className="field tnum" />
          </div>
          {rescueNum > originalNum && <p className="col-span-2 text-[12px] text-clay">販売価格は参考価格以下にしてください。</p>}
        </div>
      </details>

      <section className="rounded-2xl bg-canvas p-4 text-[14px]" aria-label="出品内容の確認" data-testid="quick-relist-confirm">
        <p className="mb-1 text-[12px] font-bold text-ink-2">この内容で公開します</p>
        <dl className="grid grid-cols-[4.5em_1fr] gap-y-1">
          <dt className="text-ink-2">商品名</dt>
          <dd className="font-semibold">{source.name}</dd>
          <dt className="text-ink-2">価格</dt>
          <dd className="tnum font-semibold">{yen(rescueNum || 0)}</dd>
          <dt className="text-ink-2">数量</dt>
          <dd className="tnum font-semibold">{qty >= 1 ? `${qty}${unit}` : "未入力"}</dd>
          <dt className="text-ink-2">受取時間</dt>
          <dd className="tnum font-semibold" data-testid="quick-relist-confirm-pickup">
            {pickup || "未入力"}
          </dd>
        </dl>
      </section>

      {state && !state.ok && <Notice tone="error">{state.message}</Notice>}
      <SubmitButton size="lg" className="w-full" disabled={!ready} pendingLabel="出品しています…" data-testid="quick-relist-submit">
        この内容で出品する
      </SubmitButton>
    </form>
  );
}
