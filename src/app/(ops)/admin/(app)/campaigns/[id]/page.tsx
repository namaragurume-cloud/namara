import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckAll, CopyButton, SubmitButton } from "@/components/ops/client";
import { channelLabel, phaseTone } from "@/components/ops/phase";
import { Badge, ButtonLink, Card, Empty, Flash, Stat, buttonClass, inputClass } from "@/components/ops/ui";
import { fmtDate, fmtDateLong, fmtDateTime, fmtNum, fmtSlot, jstDate } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { isEmailConfigured } from "@/lib/ops/email";
import { lineShareUrl } from "@/lib/ops/line";
import {
  buildReport,
  confirmedMsg,
  loadBundle,
  pct,
  phaseLabel,
  phaseOf,
  prRequestMsg,
  proposeSlots,
  restaurantReportMsg,
  restaurantScheduleMsg,
  slotLabel,
} from "@/lib/ops/service";
import { restaurantPortalUrl } from "@/lib/ops/urls";
import {
  confirmScheduleAction,
  insightRequestAction,
  markConfirmedAction,
  markSentAction,
  removeAssignment,
  reopenReport,
  saveReportComment,
  sendReportAction,
  sendRequestsAction,
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
            回答期限 {fmtDate(c.replyDeadline)}・投稿期限 {fmtDate(c.postDeadline)}
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
                          <input type="date" name={`post_${r.a.id}`} defaultValue={r.a.plannedPostDate} max={c.postDeadline} className={inputClass} />
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
      <Step n={4} title="投稿・インサイトの回収（自動）" done={report.total > 0 && report.submitted === report.total}>
        {confirmed.length === 0 ? (
          <Empty>撮影日が確定するとここに表示されます。</Empty>
        ) : (
          <>
            <p className="text-sm text-muted">
              毎月{process.env.OPS_INSIGHT_DAY && process.env.OPS_INSIGHT_DAY !== "last" ? `${process.env.OPS_INSIGHT_DAY}日` : "末日"}
              に、投稿予定日を過ぎた人へ提出のお願いが自動で届きます。3日たっても未提出なら1回リマインドします。
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
                        {r.a.insight ? (
                          <Badge tone="green">提出済 再生{fmtNum(r.a.insight.views)}</Badge>
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
              <Stat label="提出" value={`${report.submitted}/${report.total}`} />
              <Stat label="合計再生数" value={fmtNum(report.sum.views)} />
              <Stat label="合計リーチ" value={fmtNum(report.sum.reach)} />
              <Stat label="エンゲージメント率" value={pct(report.rate)} sub={`反応 ${fmtNum(report.sum.engagement)}件`} />
            </div>
            <form action={saveReportComment.bind(null, c.id)} className="mt-4 space-y-2">
              <label className="block text-sm font-bold" htmlFor="reportComment">
                レポートに載せるコメント（任意）
              </label>
              <textarea id="reportComment" name="reportComment" rows={3} defaultValue={c.reportComment} className={inputClass} placeholder="例：保存数が多く、来店検討につながる反応が多く見られました。" />
              <SubmitButton variant="outline" size="sm">
                コメントを保存
              </SubmitButton>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href={`/p/${c.shareToken}#report`} target="_blank" variant="dark">
                レポートを確認
              </ButtonLink>
              {report.submitted < report.total && <p className="w-full text-xs text-amber-700">※ まだ未提出の人がいます（{report.total - report.submitted}人）。このまま送ることもできます。</p>}
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
            <dt className="text-xs font-bold text-muted">投稿期限</dt>
            <dd>{fmtDateLong(c.postDeadline)}</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
