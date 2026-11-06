import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/ops/client";
import { DateCalendar } from "@/components/ops/DateCalendar";
import { DemoBanner } from "@/components/ops/DemoBanner";
import { Badge, Card, Field, Flash, inputClass } from "@/components/ops/ui";
import { fmtDateLong, fmtPostDates, fmtSlot, jstDate } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { findCreatorByToken, slotLabel } from "@/lib/ops/service";
import { InsightView } from "@/components/ops/InsightView";
import { ShotUploader } from "@/components/ops/ShotUploader";
import { isComplete, platformLabel, screenshotGuide } from "@/lib/ops/insight-fields";
import { listShots } from "@/lib/ops/insights";
import type { Platform } from "@/lib/ops/types";
import { isAiConfigured } from "@/lib/ops/vision";
import { respond, savePostUrl } from "../../actions";

export const metadata = { title: "PRのご依頼" };

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
  const shots = confirmed ? await listShots(a.id) : [];
  const fromCreator: Platform | undefined = /tiktok/i.test(creator.platform) ? "tiktok" : /instagram/i.test(creator.platform) ? "instagram" : undefined;
  const guidePlatforms: Platform[] = a.platform ? [a.platform] : fromCreator ? [fromCreator] : ["instagram", "tiktok"];

  return (
    <>
    <DemoBanner who="creator" />
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
          <p className="mt-1 text-sm">投稿日：{a.plannedPostDate ? fmtDateLong(a.plannedPostDate) : `${fmtPostDates(c)}のいずれか`}</p>
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
              <dt className="text-xs font-bold text-muted">投稿日</dt>
              <dd>{fmtPostDates(c)}</dd>
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
            <Field label="投稿日" required={Boolean(c.postDates?.length) && !locked} hint={c.postDates?.length ? "色のついた日から、投稿する日を1日選んでください（参加する場合）" : "投稿する日を選んでください"}>
              <span className="block">
                <DateCalendar name="plannedPostDate" mode="single" initial={a.plannedPostDate ? [a.plannedPostDate] : []} allowed={c.postDates?.length ? c.postDates : undefined} today={today} />
              </span>
            </Field>
            <Field label="メモ（任意）" hint="同伴者の有無、苦手な食材、時間の希望など">
              <textarea name="note" rows={2} defaultValue={a.note} className={inputClass} />
            </Field>
            <SubmitButton className="w-full">{a.respondedAt ? "回答を更新する" : "回答する"}</SubmitButton>
          </form>
        </Card>
      )}

      {confirmed && (
        <Card title="投稿のインサイト" actions={i && (isComplete(i) ? <Badge tone="green">そろいました</Badge> : <Badge tone="red">足りない項目あり</Badge>)}>
          {!closed && (
            <div className="mb-4 rounded-xl bg-mist p-3 text-xs leading-relaxed">
              <p className="font-bold">投稿後しばらくして（月末にお知らせします）、次の画面のスクショを送ってください</p>
              {guidePlatforms.map((p) => (
                <div key={p} className="mt-2">
                  <p className="font-bold text-muted">{platformLabel[p]}</p>
                  <ul className="mt-0.5 list-disc pl-5">
                    {screenshotGuide[p].map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {creator.lineUserId && <p className="mt-2 font-bold text-emerald-800">公式LINEのトークに画像を送るだけでもOKです。</p>}
            </div>
          )}
          <ShotUploader assignmentId={a.id} token={token} shots={shots.map((s) => ({ id: s.id, url: `/api/ops/shots/${s.id}?token=${token}` }))} canAnalyze={isAiConfigured()} disabled={closed} />
          {i ? (
            <div className="mt-4">
              <InsightView insight={i} />
              {i.missing.length > 0 && !closed && <p className="mt-2 text-xs text-muted">足りない項目が写っている画面のスクショを追加してください。自動でもう一度読み取ります。</p>}
            </div>
          ) : (
            shots.length > 0 && <p className="mt-3 text-sm text-muted">{isAiConfigured() ? "読み取りが終わるとここに数字が表示されます。" : "画像を受け取りました。担当者が確認します。"}</p>
          )}
          {!closed && (
            <form action={savePostUrl.bind(null, token, a.id)} className="mt-4 flex gap-2">
              <input name="postUrl" type="url" defaultValue={a.postUrl} placeholder="投稿のURL（任意）https://..." className={inputClass} />
              <SubmitButton variant="outline" size="sm" className="shrink-0">
                保存
              </SubmitButton>
            </form>
          )}
        </Card>
      )}
    </div>
    </>
  );
}
