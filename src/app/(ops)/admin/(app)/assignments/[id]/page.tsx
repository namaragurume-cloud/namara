import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton, SubmitButton } from "@/components/ops/client";
import { statusLabel } from "@/components/ops/phase";
import { Card, Field, inputClass } from "@/components/ops/ui";
import { fmtDateTime, fmtSlot } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { assignmentUrl } from "@/lib/ops/urls";
import { saveAssignment } from "../../../actions";

export const metadata = { title: "依頼の詳細" };

const num = (name: string, label: string, v?: number) => (
  <Field label={label}>
    <input name={name} inputMode="numeric" defaultValue={v ?? ""} className={inputClass} />
  </Field>
);

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await db.get("assignments", id);
  if (!a) notFound();
  const [c, creator] = await Promise.all([db.get("campaigns", a.campaignId), db.get("creators", a.creatorId)]);
  if (!c || !creator) notFound();
  const url = assignmentUrl(creator, a);
  const i = a.insight;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/admin/campaigns/${c.id}`} className="text-sm text-muted">
          ← {c.title}
        </Link>
        <h1 className="text-xl font-extrabold md:text-2xl">{creator.name}さんへの依頼</h1>
      </div>
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        本人用ページ：<span className="break-all">{url}</span> <CopyButton text={url} />
      </p>
      <p className="text-xs text-muted">
        送信 {fmtDateTime(a.sentAt) || "-"}／回答 {fmtDateTime(a.respondedAt) || "-"}／確定連絡 {fmtDateTime(a.confirmedNotifiedAt) || "-"}／インサイト依頼 {fmtDateTime(a.insightRequestedAt) || "-"}
      </p>
      <form action={saveAssignment} className="space-y-6">
        <input type="hidden" name="id" value={a.id} />
        <Card title="回答（DM・電話で返事が来たときの代理入力）">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="状態">
              <select name="status" defaultValue={a.status} className={inputClass}>
                {(Object.keys(statusLabel) as (keyof typeof statusLabel)[]).map((k) => (
                  <option key={k} value={k}>
                    {statusLabel[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="投稿予定日">
              <input type="date" name="plannedPostDate" defaultValue={a.plannedPostDate} className={inputClass} />
            </Field>
          </div>
          <fieldset className="mt-4">
            <legend className="mb-1.5 text-sm font-bold">参加できる日時</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {c.slots.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                  <input type="checkbox" name="availableSlotIds" value={s.id} defaultChecked={a.availableSlotIds.includes(s.id)} className="size-4 accent-[var(--brand)]" />
                  {fmtSlot(s)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="確定した撮影日時" hint="ここで変えても本人には連絡されません。連絡する場合は案件ページの「確定して発信者に連絡」から">
              <select name="confirmedSlotId" defaultValue={a.confirmedSlotId ?? ""} className={inputClass}>
                <option value="">未定</option>
                {c.slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {fmtSlot(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="本人からのメモ">
              <input name="note" defaultValue={a.note} className={inputClass} />
            </Field>
          </div>
        </Card>
        <Card title="投稿・インサイト（スクショで送られてきたときの代理入力）">
          <Field label="投稿URL">
            <input name="postUrl" type="url" defaultValue={a.postUrl} className={inputClass} />
          </Field>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {num("views", "再生数", i?.views)}
            {num("reach", "リーチ", i?.reach)}
            {num("likes", "いいね", i?.likes)}
            {num("comments", "コメント", i?.comments)}
            {num("saves", "保存", i?.saves)}
            {num("shares", "シェア", i?.shares)}
            {num("profileVisits", "プロフィールアクセス", i?.profileVisits)}
            {num("follows", "フォロー", i?.follows)}
          </div>
        </Card>
        <SubmitButton>保存</SubmitButton>
      </form>
    </>
  );
}
