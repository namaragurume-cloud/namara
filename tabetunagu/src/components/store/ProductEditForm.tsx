"use client";

import { useActionState, useState } from "react";
import { deleteProductAction, updateProductAction } from "@/app/actions/store";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

export function ProductEditForm({
  storeId,
  product,
  reserved,
  v2 = false,
}: {
  storeId: string;
  product: { id: string; name: string; description: string; quantity: number; rescuePrice: number; originalPrice: number };
  reserved: number;
  /** v2（事前決済）がメインのときは「注文」の表現にする */
  v2?: boolean;
}) {
  const [state, action] = useActionState(updateProductAction, null);
  const [delState, delAction] = useActionState(deleteProductAction, null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="productId" value={product.id} />
        <div>
          <label className="label" htmlFor="name">
            商品名
          </label>
          <input id="name" name="name" defaultValue={product.name} maxLength={60} required className="field" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="quantity">
              数量
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={Math.max(1, reserved)}
              max={999}
              defaultValue={product.quantity}
              className="field tnum"
            />
            <p className="mt-1 text-[11px] text-muted">
              {v2 ? "販売済み" : "予約済み"} {reserved} 以上
            </p>
          </div>
          <div>
            <label className="label" htmlFor="originalPrice">
              通常価格
            </label>
            <input id="originalPrice" name="originalPrice" type="number" min={1} defaultValue={product.originalPrice} className="field tnum" />
          </div>
          <div>
            <label className="label" htmlFor="rescuePrice">
              食べつなぎ価格
            </label>
            <input id="rescuePrice" name="rescuePrice" type="number" min={1} defaultValue={product.rescuePrice} className="field tnum" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="description">
            紹介文
          </label>
          <textarea id="description" name="description" rows={4} maxLength={600} defaultValue={product.description} className="field" />
        </div>
        <p className="text-[12px] text-muted">
          {v2
            ? "価格の変更は、これからのご注文に反映されます（注文済みの方は注文時の価格のままです）。"
            : "価格の変更は、これからの予約に反映されます（予約済みの方は予約時の価格のままです）。"}
        </p>
        {state && <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>}
        <SubmitButton>保存する</SubmitButton>
      </form>

      <div className="border-t border-line pt-5">
        {delState && !delState.ok && <Notice tone="error">{delState.message}</Notice>}
        {confirmDelete ? (
          <form action={delAction} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="storeId" value={storeId} />
            <input type="hidden" name="productId" value={product.id} />
            <span className="text-[13px]">この出品を削除しますか？</span>
            <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
              やめる
            </Button>
            <SubmitButton variant="danger" size="sm">
              削除する
            </SubmitButton>
          </form>
        ) : (
          <Button type="button" variant="ghost" size="sm" className="text-clay" onClick={() => setConfirmDelete(true)}>
            この出品を削除
          </Button>
        )}
      </div>
    </div>
  );
}
