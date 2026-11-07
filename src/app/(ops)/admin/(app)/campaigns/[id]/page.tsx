import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckAll, CopyButton, SubmitButton } from "@/components/ops/client";
import { channelLabel, phaseTone } from "@/components/ops/phase";
import { Badge, ButtonLink, Card, Empty, Field, Flash, Stat, buttonClass, inputClass } from "@/components/ops/ui";
import { fmtDate, fmtDateLong, fmtDateTime, fmtNum, fmtPostDates, fmtSlot, jstDate } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { isEmailConfigured } from "@/lib/ops/email";
import { lineShareUrl } from "@/lib/ops/line";
import {
  confirmedMsg,
  loadBundle,
  phaseLabel,
  phaseOf,
  prRequestMsg,
  proposeSlots,
  restaurantReportMsg,
  restaurantScheduleMsg,
  slotLabel,
} from "@/lib/ops/service";
import { restaurantPortalUrl } from "@/lib/ops/urls";
import { fieldLabel, isComplete, platformLabel } from "@/lib/ops/insight-fields";
import { buildReport, pct, pct1 } from "@/lib/ops/report";
import { isAiConfigured } from "@/lib/ops/vision";
import {
  addPastParticipants,
  confirmScheduleAction,
  draftReportAction,
  insightRequestAction,
  markConfirmedAction,
  markSentAction,
  removeAssignment,
  reopenReport,
  saveReportComment,
  sendReportAction,
  sendRequestsAction,
  setLiveShare,
  shareScheduleAction,
} from "../../../actions";

export const metadata = { title: "案件" };

function Step({ n, title, done, children, actions }: { n: number; title: string; done?: boolean; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span className={`num flex size-7 items-center justify-center rounded-full text-sm ${done ? "bg-emerald-600 text-white" : "bg-ink text-white"}`}>{done ? "✓" : n}</span>
          {title}
        </span>
      }
      actions={actions}
    >
      {children}
    </Card>
  );
}

function ManualSend({ text, onDone, doneLabel }: { text: string; onDone: () => Promise<void>; doneLabel: string }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <CopyButton text={text} label="文面をコピー" />
      <a href={lineShareUrl(text)} target="_blank" rel="noopener" className={buttonClass("outline", "sm")}>
        LINEで送る
      </a>
      <form action={onDone}>
        <SubmitButton variant="outline" size="sm">
          {doneLabel}
        </SubmitButton>
      </form>
    </span>
  );
}

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ flash?: string }> }) {
  const [{ id }, { flash }] = await Promise.all([params, searchParams]);
  const b = await loadBundle(id);
  if (!b) notFound();
  const { campaign: c, restaurant, rows } = b;
  const today = jstDate();
  const phase = phaseOf(b, today);
  const creators = (await db.list("creators")).filter((x) => x.active).sort((x, y) => (y.followers ?? 0) - (x.followers ?? 0));
  const assignedIds = new Set(rows.map((r) => r.creator.id));

  const accepted = rows.filter((r) => r.a.status === "accepted");
  const waiting = rows.filter((r) => r.a.status === "sent");
  const declined = rows.filter((r) => r.a.status === "declined");
  const unsent = rows.filter((r) => r.a.status === "unsent");
  const proposal = proposeSlots(c, rows);
  const notified = accepted.filter((r) => r.a.confirmedNotifiedAt);
  const confirmed = accepted.filter((r) => r.a.confirmedSlotId && r.a.confirmedNotifiedAt);
  const report = buildReport(b);
  const portal = restaurantPortalUrl(c);
  const canEmail = isEmailConfigured() && Boolean(restaurant?.email);
  const scheduleText = restaurantScheduleMsg(b).text;
  const reportText = restaurantReportMsg(b).text;

  return (
    <>
      <Flash text={flash} />
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            <Link href={`/admin/restaurants/${restaurant?.id}`} className="font-bold hover:text-brand">
              {restaurant?.name ?? "（店舗不明）"}
            </Link>
          </p>
          <h1 className="text-xl font-extrabold md:text-2xl">{c.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={phaseTone[phase]}>{phaseLabel[phase]}</Badge>
            回答期限 {fmtDate(c.replyDeadline)}・投稿日 {fmtPostDates(c)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/admin/campaigns/${c.id}/edit`} variant="outline" size="sm">
            内容・候補日を編集
          </ButtonLink>
          <ButtonLink href={`/p/${c.shareToken}`} target="_blank" variant="outline" size="sm">
            飲食店用ページを見る
          </ButtonLink>
        </div>
      </div>

      {/* ---------------- STEP 1 ---------------- */}
      <Step n={1} title="発信者へPR依頼を一括送信" done={rows.length > 0 && unsent.length === 0}>
        <form id="send-form" action={sendRequestsAction.bind(null, c.id)} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">依頼する人を選んで送信。LINE連携済みの人はLINE、それ以外はメールで届きます。</p>
            <CheckAll formId="send-form" name="creatorId" />
          </div>
          {creators.length === 0 ? (
            <Empty>
              発信者が登録されていません。<Link href="/admin/creators" className="font-bold underline">発信者を登録</Link>
            </Empty>
          ) : (
            <div className="grid max-h-80 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {creators.map((cr) => {
                const already = assignedIds.has(cr.id);
                const failed = unsent.some((r) => r.creator.id === cr.id);
                return (
                  <label key={cr.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${already && !failed ? "border-transparent bg-mist text-muted" : "border-line bg-white"}`}>
                    <input type="checkbox" name="creatorId" value={cr.id} disabled={already && !failed} defaultChecked={failed} className="size-4 accent-[var(--brand)]" />
                    <span className="min-w-0 flex-1 truncate">
                      <b>{cr.name}</b>
                      {cr.followers ? <span className="num ml-1 text-xs text-muted">{fmtNum(cr.followers)}</span> : null}
                    </span>
                    {already && !failed ? (
                      <span className="text-xs">依頼済</span>
                    ) : cr.lineUserId ? (
                      <Badge tone="green">LINE</Badge>
                    ) : cr.email ? (
                      <Badge tone="blue">メール</Badge>
                    ) : (
                      <Badge tone="red">手動</Badge>
                    )}
                  </label>
                );
              })}
            </div>
          )}
          <SubmitButton confirm="選んだ発信者に依頼を送信します。よろしいですか？">選んだ人に一括送信</SubmitButton>
        </form>

        <details className="mt-4 rounded-xl border border-line bg-mist p-3" open={rows.length === 0 && c.slots.every((s) => s.date < today)}>
          <summary className="cursor-pointer text-sm font-bold">実施済みの案件として記録する（発信者に連絡しない）</summary>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            すでに撮影・投稿が終わった案件のレポートを作るときに使います。選んだ発信者を「参加・撮影済み」として登録します。LINE・メールは送りません。登録後、「インサイトのスクショ回収」から各発信者のスクショを追加するか、提出のお願いを送ってください。
          </p>
          <form id="past-form" action={addPastParticipants.bind(null, c.id)} className="mt-3 space-y-3">
            <div className="flex justify-end">
              <CheckAll formId="past-form" name="creatorId" />
            </div>
            <div className="grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {creators.map((cr) => (
                <label key={cr.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${assignedIds.has(cr.id) ? "border-transparent bg-white/50 text-muted" : "border-line bg-white"}`}>
                  <input type="checkbox" name="creatorId" value={cr.id} disabled={assignedIds.has(cr.id)} className="size-4 accent-[var(--brand)]" />
                  <b className="truncate">{cr.name}</b>
                  {assignedIds.has(cr.id) && <span className="ml-auto text-xs">登録済</span>}
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-bold">撮影日時</span>
                <select name="slotId" className={inputClass} defaultValue={c.slots[0]?.id}>
                  {c.slots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {fmtSlot(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-bold">投稿日（わかれば）</span>
                <input type="date" name="postDate" defaultValue={c.postDates?.[0]} className={inputClass} />
              </label>
            </div>
            <p className="text-xs text-muted">人によって撮影日・投稿日が違う場合は、登録後に各発信者の「詳細・代理入力」で直せます。</p>
            <SubmitButton variant="outline">選んだ人を実施済みとして記録</SubmitButton>
          </form>
        </details>

        {unsent.length > 0 && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-sm font-bold text-rose-800">自動で送れなかった人（{unsent.length}人）：文面をコピーしてDMなどで送り、「送信済みにする」を押してください</p>
            <ul className="mt-2 space-y-2">
              {unsent.map((r) => (
                <li key={r.a.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <b className="min-w-24">{r.creator.name}</b>
                  <ManualSend text={prRequestMsg(b, r.creator, r.a).text} onDone={markSentAction.bind(null, c.id, r.a.id)} doneLabel="送信済みにする" />
                  <form action={removeAssignment.bind(null, c.id, r.a.id)}>
                    <SubmitButton variant="danger" size="sm">
                      取り消す
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Step>

      {/* ---------------- STEP 2 ---------------- */}
      <Step n={2} title="回答の集計・撮影日の確定" done={accepted.length > 0 && notified.length === accepted.length}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="参加" value={accepted.length} />
          <Stat label="回答待ち" value={waiting.length} />
          <Stat label="見送り" value={declined.length} />
          <Stat label="確定連絡済み" value={`${notified.length}/${accepted.length}`} />
        </div>

        <h3 className="mt-5 text-sm font-bold">候補日ごとの参加可能者</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {c.slots.map((s) => {
            const avail = accepted.filter((r) => r.a.availableSlotIds.includes(s.id));
            const assigned = accepted.filter((r) => proposal.get(r.a.id) === s.id);
            return (
              <div key={s.id} className="rounded-xl border border-line p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <b>{fmtSlot(s)}</b>
                  <span className={`num text-xs ${assigned.length >= s.capacity ? "font-bold text-emerald-700" : "text-muted"}`}>
                    割当 {assigned.length}/{s.capacity}人
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{avail.length ? avail.map((r) => r.creator.name).join("、") : "参加可能な人はまだいません"}</p>
              </div>
            );
          })}
        </div>

        {accepted.length > 0 && (
          <form action={confirmScheduleAction.bind(null, c.id)} className="mt-5 space-y-3">
            <h3 className="text-sm font-bold">撮影日の割り当て（自動で提案しています。変更もできます）</h3>
            <div className="-mx-4 overflow-x-auto md:mx-0">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 md:px-2">発信者</th>
                    <th className="px-2 py-2">撮影日時</th>
                    <th className="px-2 py-2">投稿予定日</th>
                    <th className="px-2 py-2">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {accepted.map((r) => {
                    const pick = proposal.get(r.a.id);
                    return (
                      <tr key={r.a.id} className="border-b border-line last:border-0 align-top">
                        <td className="px-4 py-2 md:px-2">
                          <b>{r.creator.name}</b>
                          {r.a.note && <p className="mt-0.5 max-w-56 text-xs text-muted">💬 {r.a.note}</p>}
                        </td>
                        <td className="px-2 py-2">
                          <select name={`slot_${r.a.id}`} defaultValue={pick ?? ""} className={inputClass}>
                            <option value="">未定</option>
                            {c.slots.map((s) => (
                              <option key={s.id} value={s.id}>
                                {r.a.availableSlotIds.includes(s.id) ? "◯ " : "× "}
                                {fmtSlot(s)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          {c.postDates?.length ? (
                            <select name={`post_${r.a.id}`} defaultValue={r.a.plannedPostDate ?? ""} className={inputClass}>
                              <option value="">未定</option>
                              {[...new Set([...c.postDates, ...(r.a.plannedPostDate ? [r.a.plannedPostDate] : [])])].sort().map((d) => (
                                <option key={d} value={d}>
                                  {fmtDate(d)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input type="date" name={`post_${r.a.id}`} defaultValue={r.a.plannedPostDate} className={inputClass} />
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {r.a.confirmedNotifiedAt ? (
                            <Badge tone="green">確定連絡済</Badge>
                          ) : r.a.confirmedSlotId ? (
                            <span className="flex flex-col gap-1">
                              <Badge tone="red">連絡できず</Badge>
                              <ManualSend text={confirmedMsg(b, r.creator, r.a).text} onDone={markConfirmedAction.bind(null, c.id, r.a.id)} doneLabel="連絡済みにする" />
                            </span>
                          ) : (
                            <Badge tone="amber">未確定</Badge>
                          )}
                          <Link href={`/admin/assignments/${r.a.id}`} className="mt-1 block text-xs text-muted underline">
                            詳細・代理入力
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">◯＝本人が参加できると回答した日時。確定すると、本人に撮影日時・住所・投稿条件が自動で届きます（変更した人にだけ再送します）。</p>
            <SubmitButton confirm="この内容で確定し、発信者に連絡します。よろしいですか？">この内容で確定して発信者に連絡</SubmitButton>
          </form>
        )}

        {(waiting.length > 0 || declined.length > 0) && (
          <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
            {waiting.length > 0 && (
              <div className="rounded-xl bg-mist p-3">
                <p className="text-xs font-bold text-muted">回答待ち（期限前日に自動リマインド）</p>
                <ul className="mt-1 space-y-1">
                  {waiting.map((r) => (
                    <li key={r.a.id} className="flex flex-wrap items-center gap-2">
                      {r.creator.name}
                      <span className="text-xs text-muted">
                        {r.a.sentVia && channelLabel[r.a.sentVia]} {fmtDateTime(r.a.sentAt)}
                        {r.a.replyRemindedAt && "・リマインド済"}
                      </span>
                      <Link href={`/admin/assignments/${r.a.id}`} className="text-xs underline">
                        代理で回答
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {declined.length > 0 && (
              <div className="rounded-xl bg-mist p-3">
                <p className="text-xs font-bold text-muted">見送り</p>
                <ul className="mt-1 space-y-1">
                  {declined.map((r) => (
                    <li key={r.a.id}>
                      {r.creator.name}
                      {r.a.note && <span className="ml-2 text-xs text-muted">💬 {r.a.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Step>

      {/* ---------------- STEP 3 ---------------- */}
      <Step
        n={3}
        title="飲食店へ撮影日・投稿日を共有"
        done={Boolean(c.scheduleSharedAt)}
        actions={c.scheduleSharedAt && <span className="text-xs text-muted">共有 {fmtDateTime(c.scheduleSharedAt)}</span>}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-mist px-4 py-3 text-sm">
          <span className="min-w-0 flex-1">
            <b>撮影・投稿の状況をリアルタイム公開</b>
            <span className="block text-xs text-muted">
              {c.liveShare
                ? "オン：撮影日を確定した時点で、飲食店用ページに「今日・明日の撮影／投稿予定」と発信者ごとの状況が自動で表示されます。"
                : "オフ：飲食店用ページには「共有」した撮影日程だけが表示されます。"}
            </span>
          </span>
          <form action={setLiveShare.bind(null, c.id, !c.liveShare)}>
            <SubmitButton variant={c.liveShare ? "outline" : "primary"} size="sm">
              {c.liveShare ? "オフにする" : "オンにする"}
            </SubmitButton>
          </form>
        </div>
        {confirmed.length === 0 ? (
          <Empty>撮影日を確定すると、ここに共有用の文面ができます。</Empty>
        ) : (
          <>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-mist p-3 text-xs leading-relaxed">{scheduleText}</pre>
            <div className="mt-3 flex flex-wrap gap-2">
              {canEmail ? (
                <form action={shareScheduleAction.bind(null, c.id, false)}>
                  <SubmitButton confirm={`${restaurant?.email} にメールで送ります。よろしいですか？`}>{c.scheduleSharedAt ? "最新の内容をメールで再送" : "メールで飲食店に送る"}</SubmitButton>
                </form>
              ) : (
                <p className="w-full text-xs text-muted">※ 店舗のメールアドレスが未登録（またはメール送信が未設定）のため、コピーしてLINE等で送ってください。</p>
              )}
              <CopyButton text={scheduleText} label="文面をコピー" size="md" />
              <a href={lineShareUrl(scheduleText)} target="_blank" rel="noopener" className={buttonClass("outline")}>
                LINEで送る
              </a>
              {!c.scheduleSharedAt && (
                <form action={shareScheduleAction.bind(null, c.id, true)}>
                  <SubmitButton variant="outline">共有済みにする</SubmitButton>
                </form>
              )}
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              飲食店用ページ（常に最新の日程・レポートを表示）：<span className="break-all">{portal}</span>
              <CopyButton text={portal} label="URLをコピー" />
            </p>
          </>
        )}
      </Step>

      {/* ---------------- STEP 4 ---------------- */}
      <Step n={4} title="インサイトのスクショ回収（自動）" done={report.total > 0 && report.incomplete.length === 0}>
        {confirmed.length === 0 ? (
          <Empty>撮影日が確定するとここに表示されます。</Empty>
        ) : (
          <>
            <p className="text-sm text-muted">
              毎月{process.env.OPS_INSIGHT_DAY && process.env.OPS_INSIGHT_DAY !== "last" ? `${process.env.OPS_INSIGHT_DAY}日` : "末日"}
              に、投稿予定日を過ぎた人へスクショ提出のお願いが自動で届きます。{isAiConfigured() ? "届いたスクショはAIが読み取り、足りない項目があれば本人に自動で連絡します。" : "（AIの読み取りが未設定のため、届いたスクショは各行から手入力してください）"}3日たってもそろわなければ1回リマインドします。
            </p>
            <div className="-mx-4 mt-3 overflow-x-auto md:mx-0">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 md:px-2">発信者</th>
                    <th className="px-2 py-2">撮影</th>
                    <th className="px-2 py-2">投稿予定</th>
                    <th className="px-2 py-2">投稿</th>
                    <th className="px-2 py-2">インサイト</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmed.map((r) => (
                    <tr key={r.a.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2 md:px-2">
                        <Link href={`/admin/assignments/${r.a.id}`} className="font-bold hover:text-brand">
                          {r.creator.name}
                        </Link>
                      </td>
                      <td className="px-2 py-2">{slotLabel(c, r.a.confirmedSlotId)}</td>
                      <td className="px-2 py-2">{fmtDate(r.a.plannedPostDate)}</td>
                      <td className="px-2 py-2">
                        {r.a.postUrl ? (
                          <a href={r.a.postUrl} target="_blank" rel="noopener" className="text-brand underline">
                            見る
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {isComplete(r.a.insight) ? (
                          <Badge tone="green">
                            {platformLabel[r.a.insight!.platform]} 閲覧{fmtNum(r.a.insight!.metrics.views)}
                          </Badge>
                        ) : r.a.insight ? (
                          <span className="flex flex-col items-start gap-0.5">
                            <Badge tone="red">足りない項目あり</Badge>
                            <span className="text-xs text-rose-700">{r.a.insight.missing.map((k) => fieldLabel(r.a.insight!.platform, k)).join("、")}</span>
                            <span className="text-xs text-muted">{r.a.missingNotifiedAt ? `本人に連絡済 ${fmtDateTime(r.a.missingNotifiedAt)}` : "未連絡"}</span>
                          </span>
                        ) : r.a.insightRequestedAt ? (
                          <Badge tone="amber">依頼済 {fmtDateTime(r.a.insightRequestedAt)}</Badge>
                        ) : (
                          <Badge>未依頼</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form action={insightRequestAction.bind(null, c.id)} className="mt-3">
              <SubmitButton variant="outline" size="sm" confirm="投稿予定日を過ぎていて、まだ依頼していない人に今すぐ送ります。よろしいですか？">
                月末を待たずに今すぐ提出をお願いする
              </SubmitButton>
            </form>
          </>
        )}
      </Step>

      {/* ---------------- STEP 5 ---------------- */}
      <Step
        n={5}
        title="レポートを飲食店へ送付"
        done={Boolean(c.reportSentAt)}
        actions={
          <>
            {c.reportSentAt && <span className="text-xs text-muted">送付 {fmtDateTime(c.reportSentAt)}</span>}
            <a href={`/admin/campaigns/${c.id}/report.csv`} className={buttonClass("outline", "sm")}>
              CSV
            </a>
          </>
        }
      >
        {report.total === 0 ? (
          <Empty>インサイトが集まると自動でレポートが作成されます。</Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="そろった投稿" value={`${report.total - report.incomplete.length}/${report.total}`} />
              <Stat label="合計閲覧数・再生数" value={fmtNum(report.views)} />
              <Stat label="反応数" value={fmtNum(report.reactions)} sub={`ER ${pct(report.er)}`} />
              <Stat label="フォロワー以外" value={pct1(report.nonFollowerPct)} sub="閲覧数で加重平均" />
            </div>
            <form action={saveReportComment.bind(null, c.id)} className="mt-4 space-y-3">
              <p className="text-sm font-bold">レポートに載せる文章（空欄の項目はレポートに表示されません）</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="対象期間" hint="空欄なら投稿日から自動で入ります">
                  <input name="reportPeriod" defaultValue={c.reportPeriod} placeholder={report.period || "2026年11月1日〜11月30日"} className={inputClass} />
                </Field>
                <Field label="サマリー（表紙）">
                  <textarea name="reportComment" rows={3} defaultValue={c.reportComment} className={inputClass} placeholder="例：5名の発信者による5投稿で、総閲覧数は12.4万回。フォロワー以外への到達が8割を超え、新規層に広く届きました。" />
                </Field>
                <Field label="考察" hint="1行に1つ">
                  <textarea name="reportFindings" rows={5} defaultValue={c.reportFindings} className={inputClass} placeholder={"保存数が多く、来店検討につながる反応が多く見られました。\n閲覧者の約半数が25〜44歳でした。"} />
                </Field>
                <Field label="次回施策のご提案" hint="1行に1つ「見出し｜説明」">
                  <textarea name="reportProposals" rows={5} defaultValue={c.reportProposals} className={inputClass} placeholder={"TikTokの起用を増やす｜1投稿あたりの再生数がInstagramの約2倍。認知目的ならTikTokの比重を高めるのが効率的です。"} />
                </Field>
              </div>
              <SubmitButton variant="outline" size="sm">
                文章を保存
              </SubmitButton>
            </form>
            {isAiConfigured() && (
              <form action={draftReportAction.bind(null, c.id)} className="mt-2">
                <SubmitButton variant="outline" size="sm" confirm={c.reportComment || c.reportFindings ? "今の文章をAIの下書きで置き換えます。よろしいですか？" : undefined}>
                  AIで文章の下書きを作る
                </SubmitButton>
              </form>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href={`/p/${c.shareToken}#report`} target="_blank" variant="dark">
                レポートを確認
              </ButtonLink>
              {report.incomplete.length > 0 && <p className="w-full text-xs text-amber-700">※ インサイトがそろっていない人がいます（{report.incomplete.map((r) => r.creator.name).join("、")}）。このまま送ることもできます（足りない数値は「-」で表示されます）。</p>}
              {canEmail && (
                <form action={sendReportAction.bind(null, c.id, false)}>
                  <SubmitButton confirm={`${restaurant?.email} にレポートを送ります。よろしいですか？`}>{c.reportSentAt ? "メールで再送" : "メールで飲食店に送る"}</SubmitButton>
                </form>
              )}
              <CopyButton text={reportText} label="送付文をコピー" size="md" />
              <a href={lineShareUrl(reportText)} target="_blank" rel="noopener" className={buttonClass("outline")}>
                LINEで送る
              </a>
              {c.reportSentAt ? (
                <form action={reopenReport.bind(null, c.id)}>
                  <SubmitButton variant="outline">未送付に戻す</SubmitButton>
                </form>
              ) : (
                <form action={sendReportAction.bind(null, c.id, true)}>
                  <SubmitButton variant="outline">送付済みにする</SubmitButton>
                </form>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">飲食店用ページでは、送付済みにした後にレポートが表示されます（それまではあなたにだけ見えます）。</p>
          </>
        )}
      </Step>

      <Card title="依頼内容（発信者に表示される内容）">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div className="md:col-span-2">
            <dt className="text-xs font-bold text-muted">PR内容</dt>
            <dd className="whitespace-pre-wrap">{c.description || "-"}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-muted">報酬・特典</dt>
            <dd className="whitespace-pre-wrap">{c.offer || "-"}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-muted">投稿条件</dt>
            <dd className="whitespace-pre-wrap">{c.conditions || "-"}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-muted">回答期限</dt>
            <dd>{fmtDateLong(c.replyDeadline)}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-muted">投稿日</dt>
            <dd>{fmtPostDates(c)}</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
