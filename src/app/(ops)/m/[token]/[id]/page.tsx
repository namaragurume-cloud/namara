import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/ops/client";
import { Badge, Card, Field, Flash, inputClass } from "@/components/ops/ui";
import { fmtDateLong, fmtSlot, jstDate } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { findCreatorByToken, slotLabel } from "@/lib/ops/service";
import { respond, submitInsight } from "../../actions";

export const metadata = { title: "PRのご依頼" };

const numField = (name: string, label: string, v: number | undefined, required = true, hint?: string) => (
  <Field label={label} required={required} hint={hint}>
    <input name={name} inputMode="numeric" pattern="[0-9,]*" required={required} defaultValue={v ?? ""} className={inputClass} />
  </Field>
);

export default async function AssignmentPage({ params, searchParams }: { params: Promise<{ token: string; id: string }>; searchParams: Promise<{ flash?: string }> }) {
  const [{ token, id }, { flash }] = await Promise.all([params, searchParams]);
  const creator = await findCreatorByToken(token);
  const a = creator ? await db.get("assignments", id) : null;
  if (!creator || !a || a.creatorId !== creator.id) notFound();
  const c = await db.get("campaigns", a.campaignId);
  if (!c) notFound();
  const r = await db.get("restaurants", c.restaurantId);
  const today = jstDate();
  const locked = Boolean(a.confirmedNotifiedAt);
  const closed = Boolean(c.reportSentAt);
  const confirmed = a.status === "accepted" && a.confirmedSlotId && locked;
  const i = a.insight;

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <Link href={`/m/${token}`} className="text-sm text-muted">
        ← {creator.name}さんのページ
      </Link>
      <header>
        <p className="text-xs font-bold tracking-widest text-brand">PRのご依頼</p>
        <h1 className="text-xl font-extrabold">{r?.name}</h1>
        <p className="text-sm text-muted">{c.title}</p>
      </header>
      <Flash text={flash} />

      {confirmed && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-bold text-emerald-800">撮影日が確定しました</p>
          <p className="mt-1 text-lg font-extrabold">{slotLabel(c, a.confirmedSlotId)}</p>
          <p className="mt-1 text-sm">投稿予定日：{a.plannedPostDate ? fmtDateLong(a.plannedPostDate) : `${fmtDateLong(c.postDeadline)}まで`}</p>
          {r?.address && <p className="mt-1 text-sm">住所：{r.address}</p>}
          <p className="mt-2 text-xs text-muted">日程の変更が必要な場合は、担当者に直接ご連絡ください。</p>
        </div>
      )}

      <Card title="依頼内容">
        <dl className="space-y-3 text-sm">
          {c.description && (
            <div>
              <dt className="text-xs font-bold text-muted">PR内容</dt>
              <dd className="whitespace-pre-wrap">{c.description}</dd>
            </div>
          )}
          {c.offer && (
            <div>
              <dt className="text-xs font-bold text-muted">報酬・特典</dt>
              <dd className="whitespace-pre-wrap">{c.offer}</dd>
            </div>
          )}
          {c.conditions && (
            <div>
              <dt className="text-xs font-bold text-muted">投稿条件</dt>
              <dd className="whitespace-pre-wrap">{c.conditions}</dd>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs font-bold text-muted">回答期限</dt>
              <dd>{fmtDateLong(c.replyDeadline)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">投稿期限</dt>
              <dd>{fmtDateLong(c.postDeadline)}</dd>
            </div>
          </div>
          {r?.address && (
            <div>
              <dt className="text-xs font-bold text-muted">住所</dt>
              <dd>{r.address}</dd>
            </div>
          )}
        </dl>
      </Card>

      {!closed && (
        <Card
          title={locked ? "あなたの回答" : "ご回答"}
          actions={a.respondedAt && <Badge tone={a.status === "accepted" ? "green" : "gray"}>{a.status === "accepted" ? "参加で回答済み" : a.status === "declined" ? "見送りで回答済み" : ""}</Badge>}
        >
          <form action={respond.bind(null, token, a.id)} className="space-y-4">
            {!locked && (
              <fieldset>
                <legend className="mb-2 text-sm font-bold">参加しますか？</legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-3 font-bold has-[:checked]:border-brand has-[:checked]:bg-brand/5 has-[:checked]:text-brand">
                    <input type="radio" name="answer" value="yes" defaultChecked={a.status !== "declined"} className="sr-only" />
                    参加する
                  </label>
                  <label className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-3 font-bold has-[:checked]:border-zinc-500 has-[:checked]:bg-zinc-100">
                    <input type="radio" name="answer" value="no" defaultChecked={a.status === "declined"} className="sr-only" />
                    今回は見送る
                  </label>
                </div>
              </fieldset>
            )}
            {locked && <input type="hidden" name="answer" value="yes" />}
            {!locked && (
              <fieldset>
                <legend className="mb-1 text-sm font-bold">参加できる日時をすべて選んでください</legend>
                <p className="mb-2 text-xs text-muted">選んだ中から撮影日を決めてご連絡します（見送る場合は選ばなくてOK）。</p>
                <div className="space-y-1.5">
                  {c.slots.map((s) => (
                    <label key={s.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                      <input type="checkbox" name="slot" value={s.id} defaultChecked={a.availableSlotIds.includes(s.id)} disabled={s.date < today} className="size-5 accent-[var(--brand)]" />
                      <span className="font-bold">{fmtSlot(s)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <Field label="投稿予定日" hint={`${fmtDateLong(c.postDeadline)}までにお願いします。未定なら空欄でOK`}>
              <input type="date" name="plannedPostDate" min={today} max={c.postDeadline} defaultValue={a.plannedPostDate} className={inputClass} />
            </Field>
            <Field label="メモ（任意）" hint="同伴者の有無、苦手な食材、時間の希望など">
              <textarea name="note" rows={2} defaultValue={a.note} className={inputClass} />
            </Field>
            <SubmitButton className="w-full">{a.respondedAt ? "回答を更新する" : "回答する"}</SubmitButton>
          </form>
        </Card>
      )}

      {confirmed && !(closed && !i) && (
        <Card title="投稿のインサイト" actions={i && <Badge tone="green">提出済み</Badge>}>
          {closed ? (
            <p className="text-sm text-muted">提出ありがとうございました。</p>
          ) : (
            <form action={submitInsight.bind(null, token, a.id)} className="space-y-4">
              <p className="text-xs leading-relaxed text-muted">
                投稿後しばらくして（月末にお知らせします）、Instagramの投稿の「インサイトを見る」に表示される数字をそのまま入力してください。
              </p>
              <Field label="投稿のURL" required hint="投稿の「…」→「リンクをコピー」">
                <input name="postUrl" type="url" required defaultValue={a.postUrl} placeholder="https://www.instagram.com/reel/..." className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                {numField("views", "再生数（閲覧数）", i?.views)}
                {numField("reach", "リーチ", i?.reach, true, "閲覧したアカウント数")}
                {numField("likes", "いいね", i?.likes)}
                {numField("comments", "コメント", i?.comments)}
                {numField("saves", "保存", i?.saves)}
                {numField("shares", "シェア", i?.shares)}
                {numField("profileVisits", "プロフィールアクセス", i?.profileVisits, false)}
                {numField("follows", "フォロー", i?.follows, false)}
              </div>
              <SubmitButton className="w-full">{i ? "インサイトを更新する" : "インサイトを提出する"}</SubmitButton>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
