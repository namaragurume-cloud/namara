"use client";

import { useActionState } from "react";
import { changePlanAction, rotateQrAction, updateStoreSettingsAction } from "@/app/actions/store";
import { CATEGORIES } from "@/lib/categories";
import type { StoreInfo } from "@/lib/types";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

export function StoreInfoForm({ store, editable }: { store: StoreInfo; editable: boolean }) {
  const [state, action] = useActionState(updateStoreSettingsAction, null);
  const fields: { name: keyof StoreInfo; formName: string; label: string; multiline?: boolean; placeholder?: string }[] = [
    { name: "name", formName: "name", label: "店舗名" },
    { name: "address", formName: "address", label: "住所" },
    { name: "phone", formName: "phone", label: "電話番号" },
    { name: "openingHours", formName: "openingHours", label: "営業時間" },
    { name: "description", formName: "description", label: "店舗紹介", multiline: true },
    { name: "pickupNote", formName: "pickupNote", label: "受け取り時のご案内", multiline: true, placeholder: "例：レジで「TABETUNAGUの予約です」とお伝えください。" },
  ];
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="storeId" value={store.id} />
      <fieldset disabled={!editable} className="space-y-4">
        {fields.map((f) => (
          <div key={f.formName}>
            <label className="label" htmlFor={f.formName}>
              {f.label}
            </label>
            {f.multiline ? (
              <textarea id={f.formName} name={f.formName} rows={3} defaultValue={String(store[f.name] ?? "")} placeholder={f.placeholder} className="field" />
            ) : (
              <input id={f.formName} name={f.formName} defaultValue={String(store[f.name] ?? "")} className="field" required={f.formName === "name"} />
            )}
            {state?.fieldErrors?.[f.formName] && <p className="mt-1 text-[12px] text-clay">{state.fieldErrors[f.formName]}</p>}
          </div>
        ))}
        <div>
          <label className="label" htmlFor="category">
            店舗カテゴリー
          </label>
          <select id="category" name="category" defaultValue={store.category} className="field">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>}
      {editable ? <SubmitButton>保存する</SubmitButton> : <p className="text-[12px] text-muted">店舗情報の変更はオーナーのみ行えます。</p>}
    </form>
  );
}

export function ChangePlanForm({ storeId, plan, label }: { storeId: string; plan: "free" | "standard"; label: string }) {
  const [state, action] = useActionState(changePlanAction, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="plan" value={plan} />
      <SubmitButton variant={plan === "standard" ? "primary" : "secondary"} className="w-full">
        {label}
      </SubmitButton>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>}
    </form>
  );
}

export function RotateQrForm({ storeId }: { storeId: string }) {
  const [state, action] = useActionState(rotateQrAction, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("QRを再発行すると、今貼っているQRは使えなくなります。よろしいですか？")) e.preventDefault();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="storeId" value={storeId} />
      <SubmitButton variant="danger" size="sm">
        QRを再発行する
      </SubmitButton>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>}
    </form>
  );
}
