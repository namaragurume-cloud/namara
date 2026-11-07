import { SubmitButton } from "@/components/ops/client";
import { Field, inputClass } from "@/components/ops/ui";
import type { Restaurant } from "@/lib/ops/types";
import { saveRestaurant } from "../../actions";

export function RestaurantForm({ r, next }: { r?: Restaurant; next?: string }) {
  return (
    <form action={saveRestaurant} className="space-y-3">
      {r && <input type="hidden" name="id" value={r.id} />}
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="店舗名" required>
        <input name="name" required defaultValue={r?.name} className={inputClass} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="ご担当者名">
          <input name="contactName" defaultValue={r?.contactName} className={inputClass} />
        </Field>
        <Field label="メールアドレス" hint="撮影日の共有・レポートの送付先">
          <input name="email" type="email" defaultValue={r?.email} className={inputClass} />
        </Field>
        <Field label="電話番号">
          <input name="phone" defaultValue={r?.phone} className={inputClass} />
        </Field>
        <Field label="住所" hint="発信者への確定連絡に載ります">
          <input name="address" defaultValue={r?.address} className={inputClass} />
        </Field>
        <Field label="食べログ" hint="お店の食べログのページのURL（発信者への依頼に載ります）">
          <input name="tabelogUrl" type="url" defaultValue={r?.tabelogUrl} placeholder="https://tabelog.com/..." className={inputClass} />
        </Field>
        <Field label="Instagram" hint="URL か @アカウント（発信者への依頼に載ります）">
          <input name="instagramUrl" defaultValue={r?.instagramUrl} placeholder="@shop_account" className={inputClass} />
        </Field>
      </div>
      <Field label="メモ">
        <textarea name="memo" rows={2} defaultValue={r?.memo} className={inputClass} />
      </Field>
      <SubmitButton>{r ? "保存" : "登録する"}</SubmitButton>
    </form>
  );
}
