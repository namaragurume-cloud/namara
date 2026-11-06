import { SlotEditor, SubmitButton } from "@/components/ops/client";
import { DateCalendar } from "@/components/ops/DateCalendar";
import { jstDate } from "@/lib/ops/dates";
import { Field, inputClass } from "@/components/ops/ui";
import type { Campaign, Restaurant } from "@/lib/ops/types";
import { saveCampaign } from "../../actions";

export function CampaignForm({
  c,
  restaurants,
  restaurantId,
  copy,
}: {
  c?: Campaign;
  restaurants: Restaurant[];
  restaurantId?: string;
  /** 過去の案件を下書きにする */
  copy?: Campaign;
}) {
  const v = c ?? copy;
  const today = jstDate();
  return (
    <form action={saveCampaign} className="space-y-4">
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="店舗" required>
          <select name="restaurantId" required defaultValue={c?.restaurantId ?? restaurantId ?? copy?.restaurantId ?? ""} className={inputClass}>
            <option value="" disabled>
              選んでください
            </option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="案件名" required hint="例：12月 新メニューPR">
          <input name="title" required defaultValue={v?.title} className={inputClass} />
        </Field>
      </div>
      <Field label="PR内容" hint="お店の紹介・食べてほしいメニュー・訴求ポイントなど（発信者に表示されます）">
        <textarea name="description" rows={5} defaultValue={v?.description} className={inputClass} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="報酬・特典" hint="例：飲食代無料（1名様）＋謝礼 5,000円">
          <textarea name="offer" rows={3} defaultValue={v?.offer} className={inputClass} />
        </Field>
        <Field label="投稿条件" hint="例：リール1本／店舗アカウントをタグ付け／#PR 表記">
          <textarea name="conditions" rows={3} defaultValue={v?.conditions} className={inputClass} />
        </Field>
      </div>
      <Field label="撮影候補日" required hint="発信者は、この中から参加できる日時をすべて選びます。人数＝その枠に入れる人数です。">
        <span className="block">
          <SlotEditor initial={c?.slots ?? []} />
        </span>
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="投稿日" required hint="投稿してほしい日をカレンダーでタップ（複数選べます）。発信者はこの中から自分の投稿日を選びます">
          <span className="block">
            <DateCalendar name="postDates" mode="multi" initial={c?.postDates ?? []} today={today} />
          </span>
        </Field>
        <Field label="回答期限" required hint="前日に未回答の人へ自動でリマインドします">
          <input type="date" name="replyDeadline" required defaultValue={c?.replyDeadline} className={inputClass} />
        </Field>
      </div>
      <SubmitButton>{c ? "保存する" : "案件をつくる"}</SubmitButton>
    </form>
  );
}
