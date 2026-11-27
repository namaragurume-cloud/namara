import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckAll, CopyButton, SubmitButton } from "@/components/ops/client";
import { AdminShotDrop } from "@/components/ops/AdminShotDrop";
import { OpenHashTarget } from "@/components/ops/OpenHashTarget";
import { TodayNotice } from "../../TodayNotice";
import { channelLabel, phaseTone } from "@/components/ops/phase";
import { ShopLinks } from "@/components/ops/ShopLinks";
import { Badge, ButtonLink, Card, Empty, Field, Flash, Stat, buttonClass, inputClass } from "@/components/ops/ui";
import { fmtDate, fmtDateLong, fmtDateTime, fmtNum, fmtParty, fmtPostDates, fmtSlot, jstDate } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { isEmailConfigured } from "@/lib/ops/email";
import { isLineConfigured } from "@/lib/ops/line";
import { lineShareUrl } from "@/lib/ops/line";
import {
  confirmOrChangeMsg,
  postDateRequestMsg,
  rescheduleRequestMsg,
  shootBriefMsg,
  slotById,
  insightRemindTargets,
  loadBundle,
  phaseLabel,
  phaseOf,
  prRequestMsg,
  partyOf,
  proposeSlots,
  restaurantReportMsg,
  restaurantScheduleCheckMsg,
  restaurantScheduleMsg,
  slotLabel,
} from "@/lib/ops/service";
import { restaurantPortalUrl } from "@/lib/ops/urls";
import { fieldLabel, isComplete, platformLabel } from "@/lib/ops/insight-fields";
import { buildReport, pct, pct1 } from "@/lib/ops/report";
import { isAiConfigured } from "@/lib/ops/vision";
import type { Shot } from "@/lib/ops/types";
import { isPosted } from "@/lib/ops/posted";
import { describeFlex, isFlex, slotsForCampaign } from "@/lib/ops/slots";
import { videoEnabled, videoStage, videoStageLabel } from "@/lib/ops/video-state";
import {
  addPastParticipants,
  confirmScheduleAction,
  deleteCampaign,
  draftReportAction,
  insightRemindAction,
  setInsightRemindAction,
  insightRequestAction,
  markBriefSentAction,
  cancelPostDateRequestAction,
  markPostDateRequestSentAction,
  confirmOfflineAction,
  markConfirmedAction,
  markPostedAction,
  markPostedBulkAction,
  markShopCheckSentAction,
  recordShopCheckAction,
  shopCheckAction,
  shootBriefAction,
  markSentAction,
  removeAssignment,
  reRequestAction,
  readjustAction,
  markRescheduleSentAction,
  reopenReport,
  saveReportComment,
  sendReportAction,
  sendRequestsAction,
  setVideoCheck,
  setLiveShare,
  shareScheduleAction,
} from "../../../actions";

export const metadata = { title: "案件" };

/** 手順の欄。終わった手順は折りたたんで表示（見出しを押すと開く） */
function Step({ n, title, done, children, actions }: { n: number; title: string; done?: boolean; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <details open={!done} className="group rounded-2xl border border-line bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 md:p-6 [&::-webkit-details-marker]:hidden">
        <span className={`num flex size-7 shrink-0 items-center justify-center rounded-full text-sm ${done ? "bg-emerald-600 text-white" : "bg-ink text-white"}`}>{done ? "✓" : n}</span>
        <h2 className="min-w-0 flex-1 text-base font-bold md:text-lg">{title}</h2>
        {done && <span className="text-xs text-muted group-open:hidden">完了・押すと開く</span>}
        <span aria-hidden className="text-muted transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="px-4 pb-4 md:px-6 md:pb-6">
        {actions && <div className="mb-4 flex flex-wrap justify-end gap-2">{actions}</div>}
        {children}
      </div>
    </details>
  );
}

/** 手動で送る（文面コピー・自分のLINE・送信済みにする）。inForm：ほかのフォームの中に置くとき（フォームの入れ子を避ける） */
function ManualSend({ text, onDone, doneLabel, inForm }: { text: string; onDone: () => Promise<void>; doneLabel: string; inForm?: boolean }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <CopyButton text={text} label="文面をコピー" />
      <a href={lineShareUrl(text)} target="_blank" rel="noopener" className={buttonClass("outline", "sm")}>
        自分のLINEで送る
      </a>
      {inForm ? (
        <button formAction={onDone} formNoValidate className={buttonClass("outline", "sm")}>
          {doneLabel}
        </button>
      ) : (
        <form action={onDone}>
          <SubmitButton variant="outline" size="sm">
            {doneLabel}
          </SubmitButton>
        </form>
      )}
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
  // 投稿日を過ぎて、まだ投稿の報告がない人
  const notPostedDue = rows.filter((r) => r.a.status === "accepted" && r.a.confirmedNotifiedAt && r.a.plannedPostDate && r.a.plannedPostDate < jstDate() && !isPosted(r.a));
  const remindIds = new Set(insightRemindTargets(rows.map((r) => r.a)).map((a) => a.id));
  const remindTargets = rows.filter((r) => remindIds.has(r.a.id));
  const shotsBy = new Map<string, Shot[]>();
  for (const s of (await db.list("shots")).filter((s) => rows.some((r) => r.a.id === s.assignmentId)).sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
    shotsBy.set(s.assignmentId, [...(shotsBy.get(s.assignmentId) ?? []), s]);
  }
  // 提案から作った案件は、提案で選んだ発信者（まだ依頼していない人）にチェックを入れておく
  const fromProposal = c.proposalId && rows.length === 0 ? new Set((await db.get("proposals", c.proposalId))?.creatorIds ?? []) : new Set<string>();

  const accepted = rows.filter((r) => r.a.status === "accepted");
  const waiting = rows.filter((r) => r.a.status === "sent");
  const declined = rows.filter((r) => r.a.status === "declined");
  const unsent = rows.filter((r) => r.a.status === "unsent");
  const proposal = proposeSlots(c, rows);
  const shownSlots = slotsForCampaign(c, rows.map((r) => r.a));
  const notified = accepted.filter((r) => r.a.confirmedNotifiedAt);
  const confirmed = accepted.filter((r) => r.a.confirmedSlotId && r.a.confirmedNotifiedAt);
  const report = buildReport(b);
  const portal = restaurantPortalUrl(c);
  // お店への自動送信：公式LINE（連携済み）が優先、なければメール
  const shopLine = isLineConfigured() && Boolean(restaurant?.lineGroupId || restaurant?.lineUserId);
  const shopEmail = isEmailConfigured() && Boolean(restaurant?.email);
  const shopVia = shopLine ? (restaurant?.lineGroupId ? "公式LINE（お店のグループ）" : "公式LINE") : shopEmail ? "メール" : null;
  const shopTo = shopLine ? `お店の${shopVia}` : restaurant?.email;
  const scheduleText = (await restaurantScheduleMsg(b)).text;
  // お店に共有したあとに、変更した日程を確定した（＝送り直す内容がある）
  const needsReshare = Boolean(c.scheduleSharedAt && confirmed.length > 0 && rows.some((r) => r.a.scheduleChangedAt && r.a.scheduleChangedAt > c.scheduleSharedAt!));
  // 撮影日時を選び直してもらっている人（確定するまで共有の文面には入らない）
  const rescheduling = rows.filter((r) => r.a.status === "sent" && r.a.rescheduleRequestedAt);
  const reportText = (await restaurantReportMsg(b)).text;
  const requestTexts = new Map(await Promise.all(unsent.map(async (r) => [r.a.id, (await prRequestMsg(b, r.creator, r.a)).text] as const)));
  // 日程の再調整のお願いを自動で送れなかった人
  const rescheduleTexts = new Map(
    await Promise.all(waiting.filter((r) => r.a.rescheduleRequestedAt && r.a.rescheduleFailedAt).map(async (r) => [r.a.id, (await rescheduleRequestMsg(b, r.creator, r.a)).text] as const)),
  );
  // 投稿日の再調整のお願いを自動で送れなかった人（手動で送るための文面）
  const postReqTexts = new Map(
    await Promise.all(
      accepted.filter((r) => r.a.postDateRequestedAt && r.a.postDateRequestFailedAt).map(async (r) => [r.a.id, (await postDateRequestMsg(b, r.creator, r.a)).text] as const),
    ),
  );
  // 撮影の詳細：撮影日時が決まって連絡済みの人
  const briefRows = accepted.filter((r) => r.a.confirmedNotifiedAt && r.a.confirmedSlotId);
  const briefFailedTexts = new Map(
    c.shootBrief
      ? await Promise.all(briefRows.filter((r) => r.a.briefFailedAt && !r.a.briefSentAt).map(async (r) => [r.a.id, (await shootBriefMsg(b, r.creator, r.a, c.shootBrief!)).text] as const))
      : [],
  );
  const shopCheckText = c.shopCheck && !c.shopCheck.delivered ? (await restaurantScheduleCheckMsg(b)).text : "";
  const confirmTexts = new Map(
    await Promise.all(accepted.filter((r) => r.a.confirmedSlotId && !r.a.confirmedNotifiedAt).map(async (r) => [r.a.id, (await confirmOrChangeMsg(b, r.creator, r.a)).text] as const)),
  );

  return (
    <>
      <Flash text={flash} />
      <OpenHashTarget />
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

      <TodayNotice campaignId={c.id} />

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
                const failed = unsent.some((r) => r.creator.id === cr.id);
                const wasDeclined = declined.some((r) => r.creator.id === cr.id);
                // 見送りの人は、もう一度選んで送れる
                const already = assignedIds.has(cr.id) && !wasDeclined;
                return (
                  <label key={cr.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${already && !failed ? "border-transparent bg-mist text-muted" : "border-line bg-white"}`}>
                    <input type="checkbox" name="creatorId" value={cr.id} disabled={already && !failed} defaultChecked={failed || fromProposal.has(cr.id)} className="size-4 accent-[var(--brand)]" />
                    <span className="min-w-0 flex-1 truncate">
                      <b>{cr.name}</b>
                      {cr.followers ? <span className="num ml-1 text-xs text-muted">{fmtNum(cr.followers)}</span> : null}
                    </span>
                    {already && !failed ? (
                      <span className="text-xs">依頼済</span>
                    ) : wasDeclined ? (
                      <Badge tone="amber">見送り・再依頼可</Badge>
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
          {creators.some((cr) => !assignedIds.has(cr.id) || unsent.some((r) => r.creator.id === cr.id)) && (
            <details className="rounded-xl border border-line bg-mist p-3">
              <summary className="cursor-pointer text-sm font-bold">人ごとに報酬を変える（任意）</summary>
              <p className="mt-2 text-xs text-muted">
                空欄の人には、案件の共通の報酬「{c.offer || "（未設定）"}」が届きます。入れた内容はその人にだけ表示され、ほかの発信者やお店には見えません。チェックを入れた人だけに使われます。
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {creators
                  .filter((cr) => !assignedIds.has(cr.id) || unsent.some((r) => r.creator.id === cr.id))
                  .map((cr) => (
                    <label key={cr.id} className="flex items-center gap-2 text-sm">
                      <span className="w-24 shrink-0 truncate font-bold">{cr.name}</span>
                      <input
                        name={`offer_${cr.id}`}
                        defaultValue={unsent.find((r) => r.creator.id === cr.id)?.a.offer}
                        placeholder={c.offer || "例：飲食代無料＋謝礼 8,000円"}
                        className={inputClass}
                      />
                    </label>
                  ))}
              </div>
            </details>
          )}
          <SubmitButton confirm="選んだ発信者に依頼を送信します。よろしいですか？">選んだ人に一括送信</SubmitButton>
        </form>

        <details className="mt-4 rounded-xl border border-line bg-mist p-3" open={rows.length === 0 && (isFlex(c) ? c.flex!.to < today : c.slots.every((s) => s.date < today))}>
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
              {isFlex(c) ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="block">
                    <span className="mb-1 block font-bold">撮影日</span>
                    <input type="date" name="pastDate" defaultValue={c.flex!.from} className={inputClass} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-bold">開始時刻</span>
                    <input type="time" name="pastTime" defaultValue={c.flex!.start} className={inputClass} />
                  </label>
                </div>
              ) : (
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
              )}
              <label className="block text-sm">
                <span className="mb-1 block font-bold">投稿日（空欄なら各発信者に入力してもらう）</span>
                <input type="date" name="postDate" className={inputClass} />
              </label>
            </div>
            <p className="text-xs text-muted">投稿日を空欄にすると、インサイト提出のお願いに「投稿日も入力してください」と入り、各発信者が提出ページで入力します。撮影日が人によって違う場合は、登録後に各発信者の「詳細・代理入力」で直せます。</p>
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
                  <ManualSend text={requestTexts.get(r.a.id) ?? ""} onDone={markSentAction.bind(null, c.id, r.a.id)} doneLabel="送信済みにする" />
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

        <h3 className="mt-5 text-sm font-bold">{isFlex(c) ? "希望の日時ごとの人" : "候補日ごとの参加可能者"}</h3>
        {isFlex(c) && <p className="mt-1 text-xs text-muted">撮影できる期間：{describeFlex(c.flex!)}（発信者の第1〜第3希望が集まります）</p>}
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {shownSlots.length === 0 && <p className="text-sm text-muted">まだ希望の日時はありません。</p>}
          {shownSlots.map((s) => {
            const avail = accepted.filter((r) => r.a.availableSlotIds.includes(s.id));
            const assigned = accepted.filter((r) => proposal.get(r.a.id) === s.id);
            const people = assigned.reduce((n, r) => n + partyOf(r.a), 0);
            return (
              <div key={s.id} className="rounded-xl border border-line p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <b>{fmtSlot(s)}</b>
                  <span className={`num text-xs ${people > s.capacity ? "font-bold text-rose-700" : people === s.capacity ? "font-bold text-emerald-700" : "text-muted"}`}>
                    {people > s.capacity ? "定員オーバー " : ""}割当 {people}/{s.capacity}名（同伴含む）
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{avail.length
                    ? avail
                        .map((r) => `${r.creator.name}${(r.a.partySize ?? 1) > 1 ? `（${r.a.partySize}名）` : ""}${isFlex(c) ? `・第${r.a.availableSlotIds.indexOf(s.id) + 1}希望` : ""}`)
                        .join("、")
                    : "参加可能な人はまだいません"}</p>
              </div>
            );
          })}
        </div>

        {accepted.length > 0 && restaurant && (
          <div id="shopcheck" className="mt-5 scroll-mt-20 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm">
            <h3 className="flex flex-wrap items-center gap-2 font-bold">
              お店への日程の確認（確定する前に）
              {c.shopCheck &&
                (c.shopCheck.status === "ok" ? (
                  <Badge tone="green">OK</Badge>
                ) : c.shopCheck.status === "change" ? (
                  <Badge tone="red">変更の希望あり</Badge>
                ) : (
                  <Badge tone="amber">確認待ち</Badge>
                ))}
            </h3>
            {!c.shopCheck ? (
              <p className="mt-1 text-xs text-muted">下の表で撮影日時を選んで「この日程でお店に確認する」を押すと、発信者に連絡する前にお店に日程を確認してもらえます。</p>
            ) : (
              <div className="mt-1 space-y-2">
                <p className="text-xs text-muted">
                  {fmtDateTime(c.shopCheck.sentAt)}に確認をお願いしました
                  {c.shopCheck.answeredAt && `／${fmtDateTime(c.shopCheck.answeredAt)}に回答${c.shopCheck.name ? `（${c.shopCheck.name}）` : ""}`}
                </p>
                {c.shopCheck.status === "change" && c.shopCheck.comment && (
                  <p className="whitespace-pre-wrap rounded-lg bg-white px-3 py-2 text-rose-800">💬 {c.shopCheck.comment}</p>
                )}
                {c.shopCheck.status === "ok" && <p className="text-emerald-800">お店のOKが出ました。下の「この内容で確定して発信者に連絡」で発信者に連絡してください。</p>}
                {!c.shopCheck.delivered && (
                  <div>
                    <p className="mb-1 text-xs font-bold text-rose-700">お店に自動で送れませんでした。文面をコピーして送ってください。</p>
                    <ManualSend text={shopCheckText} onDone={markShopCheckSentAction.bind(null, c.id)} doneLabel="送信済みにする" />
                  </div>
                )}
                {c.shopCheck.status === "pending" && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted">お店からLINEなどで返事が来たときは、ここで記録</summary>
                    <form action={recordShopCheckAction.bind(null, c.id, true)} className="mt-2">
                      <SubmitButton variant="outline" size="sm">
                        お店のOKを記録
                      </SubmitButton>
                    </form>
                    <form action={recordShopCheckAction.bind(null, c.id, false)} className="mt-2 flex flex-wrap gap-2">
                      <input name="comment" placeholder="お店の希望（例：11/25は14時以降にしてほしい）" className={`${inputClass} min-w-48 flex-1`} />
                      <SubmitButton variant="outline" size="sm">
                        変更の希望を記録
                      </SubmitButton>
                    </form>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

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
                    // お店に確認中の日時があればそれを、なければ自動の提案を選んでおく
                    const pick = !r.a.confirmedNotifiedAt && r.a.tentativeSlotId ? r.a.tentativeSlotId : proposal.get(r.a.id);
                    return (
                      <tr key={r.a.id} className="border-b border-line last:border-0 align-top">
                        <td className="px-4 py-2 md:px-2">
                          <b>{r.creator.name}</b>
                          <span className="ml-1 text-xs text-muted">来店 {fmtParty(r.a.partySize)}</span>
                          {r.a.partyNote && <span className="ml-1 rounded bg-amber-100 px-1 text-xs font-bold text-amber-900">{r.a.partyNote}</span>}
                          {r.a.offer && <p className="mt-0.5 max-w-56 text-xs text-sky-800">個別の報酬：{r.a.offer}</p>}
                          {r.a.note && <p className="mt-0.5 max-w-56 text-xs text-muted">💬 {r.a.note}</p>}
                          <input
                            name={`note_${r.a.id}`}
                            placeholder="この人だけへのひとこと（任意）"
                            aria-label={`${r.creator.name}さんへのひとこと`}
                            className={`${inputClass} mt-1.5 max-w-56 !py-1.5 text-xs`}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select name={`slot_${r.a.id}`} defaultValue={pick ?? ""} className={inputClass}>
                            <option value="">未定</option>
                            {shownSlots.map((s) => {
                              const rank = r.a.availableSlotIds.indexOf(s.id);
                              return (
                                <option key={s.id} value={s.id}>
                                  {rank < 0 ? "× " : isFlex(c) ? `第${rank + 1}希望 ` : "◯ "}
                                  {fmtSlot(s)}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          {c.postDates?.length ? (
                            <select name={`post_${r.a.id}`} defaultValue={(!r.a.confirmedNotifiedAt && r.a.tentativePostDate) || r.a.plannedPostDate || ""} className={inputClass}>
                              <option value="">未定</option>
                              {[...new Set([...c.postDates, ...(r.a.plannedPostDate ? [r.a.plannedPostDate] : [])])].sort().map((d) => (
                                <option key={d} value={d}>
                                  {fmtDate(d)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input type="date" name={`post_${r.a.id}`} defaultValue={(!r.a.confirmedNotifiedAt && r.a.tentativePostDate) || r.a.plannedPostDate} className={inputClass} />
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {r.a.confirmedNotifiedAt ? (
                            <Badge tone="green">{r.a.confirmedOffline ? "確定（連絡なし）" : "確定連絡済"}</Badge>
                          ) : r.a.confirmedSlotId ? (
                            <span className="flex flex-col gap-1">
                              <Badge tone="red">連絡できず</Badge>
                              <ManualSend inForm text={confirmTexts.get(r.a.id) ?? ""} onDone={markConfirmedAction.bind(null, c.id, r.a.id)} doneLabel="連絡済みにする" />
                            </span>
                          ) : (
                            <Badge tone="amber">未確定</Badge>
                          )}
                          <Link href={`/admin/assignments/${r.a.id}`} className="mt-1 block text-xs text-muted underline">
                            詳細・代理入力
                          </Link>
                          <a href="#readjust" className="mt-0.5 block text-xs text-amber-800 underline">
                            日程を選び直してもらう
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">◯＝本人が参加できると回答した日時。確定すると、本人に撮影日時・住所・投稿条件が自動で届きます（変更した人にだけ再送します）。</p>
            <Field label="発信者へのひとこと（任意）" hint="今回連絡する全員の連絡文に入ります（例：当日は裏口からお入りください）。表の「この人だけへのひとこと」は、その人にだけ追加されます">
              <textarea name="note" rows={3} className={inputClass} />
            </Field>
            <div className="flex flex-wrap gap-2">
              {restaurant && (
                <SubmitButton
                  variant="outline"
                  formAction={shopCheckAction.bind(null, c.id)}
                  confirm="表で選んでいる日程を、お店に確認してもらいます（発信者にはまだ連絡しません）。よろしいですか？"
                >
                  この日程でお店に確認する
                </SubmitButton>
              )}
              <SubmitButton confirm="この内容で確定し、発信者に連絡します。よろしいですか？">この内容で確定して発信者に連絡</SubmitButton>
              <SubmitButton
                variant="outline"
                formAction={confirmOfflineAction.bind(null, c.id)}
                confirm="表で選んだ日時で確定します。発信者には連絡を送りません（電話などで決めた場合）。よろしいですか？"
              >
                連絡せずに確定（電話などで決めた）
              </SubmitButton>
            </div>
            <p className="text-xs text-muted">「連絡せずに確定」は、電話やDMで本人と日時を決めたとき用です。確定済みとして記録され、前日のリマインドやお店への共有はいつもどおり動きます。</p>
          </form>
        )}

        {notified.length > 0 && !c.reportSentAt && (
          <div id="readjust" className="mt-5 scroll-mt-20 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <h3 className="text-sm font-bold">日程の再調整（確定した撮影日時・投稿日を、発信者に選び直してもらう）</h3>
            <form action={readjustAction.bind(null, c.id)} className="mt-2 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xs font-bold text-muted">調整するもの</span>
                {[
                  ["shoot", "撮影日時", true],
                  ["post", "投稿日", false],
                ].map(([v, label, on]) => (
                  <label key={String(v)} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 font-bold has-[:checked]:border-brand has-[:checked]:bg-brand/5 has-[:checked]:text-brand">
                    <input type="checkbox" name="what" value={String(v)} defaultChecked={Boolean(on)} className="size-4 accent-[var(--brand)]" />
                    {label}
                  </label>
                ))}
                <span className="text-xs text-muted">撮影日時にチェック：回答画面がもう一度開き、撮影日時と投稿日を選び直してもらいます／投稿日だけ：撮影日時はそのままです</span>
              </div>
              <div className="flex justify-end">
                <CheckAll formId="readjust-to" name="readjustTo" />
              </div>
              <ul id="readjust-to" className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {notified.map((r) => (
                  <li key={r.a.id} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
                    <label className="flex items-start gap-2">
                      <input type="checkbox" name="readjustTo" value={r.a.id} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate">{r.creator.name}</b>
                        <span className="num block text-xs text-muted">撮影 {slotLabel(c, r.a.confirmedSlotId)}</span>
                        <span className="num block text-xs text-muted">投稿 {r.a.plannedPostDate ? fmtDate(r.a.plannedPostDate) : "未定"}</span>
                      </span>
                    </label>
                    {(r.a.postDateRequestedAt || r.a.postDateRechosenAt) && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-6">
                        {r.a.postDateRequestedAt && r.a.postDateRequestFailedAt ? (
                          <Badge tone="red">投稿日：連絡できず</Badge>
                        ) : r.a.postDateRequestedAt ? (
                          <Badge tone="amber">投稿日の選び直し待ち</Badge>
                        ) : (
                          <Badge tone="green">
                            投稿日 選び直し済み {r.a.postDateBefore ? `${fmtDate(r.a.postDateBefore)}→` : ""}
                            {fmtDate(r.a.plannedPostDate)}
                          </Badge>
                        )}
                        {r.a.postDateRequestedAt && (
                          <button formAction={cancelPostDateRequestAction.bind(null, c.id, r.a.id)} className="text-xs text-muted underline">
                            取り消す
                          </button>
                        )}
                      </div>
                    )}
                    {postReqTexts.has(r.a.id) && (
                      <div className="mt-1.5 pl-6">
                        <ManualSend inForm text={postReqTexts.get(r.a.id)!} onDone={markPostDateRequestSentAction.bind(null, c.id, r.a.id)} doneLabel="送信済みにする" />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <input name="reason" placeholder="理由（例：お店の都合により）" className={`${inputClass} min-w-48 flex-1`} />
                <SubmitButton variant="outline" size="sm" confirm="チェックした人に、日程の再調整をお願いします。よろしいですか？">
                  チェックした人に再調整をお願いする
                </SubmitButton>
              </div>
              <p className="text-xs text-muted">
                お店の希望日時が候補にない場合は、先に「内容・候補日を編集」で撮影候補日・投稿日を追加してください。候補の中でこちらが日時を決めるだけなら、上の表で変えて「確定して発信者に連絡」を押せば「日程変更」の連絡が届きます。
              </p>
            </form>
          </div>
        )}

        {(waiting.length > 0 || declined.length > 0) && (
          <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
            {waiting.length > 0 && (
              <div id="waiting" className="scroll-mt-20 rounded-xl bg-mist p-3">
                <p className="text-xs font-bold text-muted">回答待ち（期限前日に自動リマインド）</p>
                <ul className="mt-1 space-y-1">
                  {waiting.map((r) => (
                    <li key={r.a.id} className="flex flex-wrap items-center gap-2">
                      {r.creator.name}
                      <span className="text-xs text-muted">
                        {r.a.sentVia && channelLabel[r.a.sentVia]} {fmtDateTime(r.a.sentAt)}
                        {r.a.replyRemindedAt && "・リマインド済"}
                      </span>
                      {r.a.offer && <span className="text-xs text-sky-800">個別の報酬：{r.a.offer}</span>}
                      {r.a.reRequestedAt && <span className="text-xs font-bold text-amber-800">再依頼</span>}
                      {r.a.rescheduleRequestedAt && (
                        <span className="text-xs font-bold text-amber-800">
                          再調整中（前：{slotLabel(c, r.a.previousSlotId)}
                          {r.a.rescheduleReason ? `／${r.a.rescheduleReason}` : ""}）
                        </span>
                      )}
                      {rescheduleTexts.has(r.a.id) && (
                        <span className="flex w-full flex-wrap items-center gap-1.5">
                          <Badge tone="red">連絡できず</Badge>
                          <ManualSend text={rescheduleTexts.get(r.a.id)!} onDone={markRescheduleSentAction.bind(null, c.id, r.a.id)} doneLabel="送信済みにする" />
                        </span>
                      )}
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
                <p className="text-xs font-bold text-muted">見送り（もう一度依頼できます）</p>
                <ul className="mt-1 space-y-2">
                  {declined.map((r) => (
                    <li key={r.a.id}>
                      <span>
                        {r.creator.name}
                        {r.a.note && <span className="ml-2 text-xs text-muted">💬 {r.a.note}</span>}
                      </span>
                      <form action={reRequestAction.bind(null, c.id, r.creator.id)} className="mt-1 flex gap-2">
                        <input name="note" placeholder="ひとこと（例：候補日を追加しました）" className={`${inputClass} py-1.5 text-xs`} />
                        <SubmitButton variant="outline" size="sm" className="shrink-0" confirm={`${r.creator.name}さんにもう一度依頼します。よろしいですか？`}>
                          もう一度依頼する
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Step>

      {briefRows.length > 0 && !c.reportSentAt && (
        <section id="brief" className="scroll-mt-20">
          <Card title="撮影日時が決まった人へ、撮影の詳細を連絡">
            <form action={shootBriefAction.bind(null, c.id)} className="space-y-3">
              <Field label="撮影の詳細" hint="撮影してほしいメニュー・内容、来店時の伝え方、注意事項など。各自の撮影日時と住所は自動で入ります">
                <textarea
                  name="brief"
                  rows={6}
                  defaultValue={c.shootBrief}
                  placeholder={"例）\n・撮影していただきたいメニュー：特選盛り合わせ、冷麺\n・入口で「MIRATSUMUの撮影です」とお伝えください\n・お店の外観も1枚撮っていただけると助かります"}
                  className={inputClass}
                />
              </Field>
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold">送る人</p>
                  <CheckAll formId="brief-to" name="briefTo" />
                </div>
                <ul id="brief-to" className="grid gap-1.5 sm:grid-cols-2">
                  {briefRows
                    .slice()
                    .sort((x, y) => (slotById(c, x.a.confirmedSlotId)?.date ?? "").localeCompare(slotById(c, y.a.confirmedSlotId)?.date ?? ""))
                    .map((r) => (
                      <li key={r.a.id} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="briefTo" value={r.a.id} defaultChecked={!r.a.briefSentAt} className="size-4 accent-[var(--brand)]" />
                          <b className="min-w-0 truncate">{r.creator.name}</b>
                          <span className="num text-xs text-muted">{slotLabel(c, r.a.confirmedSlotId)}</span>
                          <span className="ml-auto shrink-0">
                            {r.a.briefSentAt ? (
                              <Badge tone="green">送信済 {fmtDateTime(r.a.briefSentAt)}</Badge>
                            ) : r.a.briefFailedAt ? (
                              <Badge tone="red">送れず</Badge>
                            ) : (
                              <Badge>未送信</Badge>
                            )}
                          </span>
                        </label>
                        {briefFailedTexts.has(r.a.id) && (
                          <div className="mt-1.5">
                            <ManualSend inForm text={briefFailedTexts.get(r.a.id)!} onDone={markBriefSentAction.bind(null, c.id, r.a.id)} doneLabel="送信済みにする" />
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
                <p className="mt-1 text-xs text-muted">まだ送っていない人にチェックが入っています。内容を直して送り直すときは、送り直す人にチェックを入れてください。</p>
              </div>
              <SubmitButton confirm="チェックした人に、撮影の詳細を送ります。よろしいですか？">チェックした人に送る</SubmitButton>
            </form>
          </Card>
        </section>
      )}

      {/* ---------------- STEP 3 ---------------- */}
      <Step
        n={3}
        title="飲食店へ撮影日・投稿日を共有"
        done={Boolean(c.scheduleSharedAt)}
        actions={c.scheduleSharedAt && <span className="text-xs text-muted">共有 {fmtDateTime(c.scheduleSharedAt)}</span>}
      >
        {needsReshare && (
          <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            お店に共有したあとに、日程が変わりました。最新の内容をお店に送ってください（下の「再送」または「自分のLINEで送る」）。
          </p>
        )}
        {rescheduling.length > 0 && (
          <p className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            日程の再調整中：{rescheduling.map((r) => `${r.creator.name}さん`).join("、")}。
            選び直した日程を「② 回答の集計・撮影日の確定」で確定すると、ここの文面に入ります（それまでの文面には入りません）。
          </p>
        )}
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
          <Empty>{rescheduling.length ? "再調整中の人の日程を確定すると、ここに共有用の文面ができます。" : "撮影日を確定すると、ここに共有用の文面ができます。"}</Empty>
        ) : (
          <>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-mist p-3 text-xs leading-relaxed">{scheduleText}</pre>
            <div className="mt-3 flex flex-wrap gap-2">
              {shopVia ? (
                <form action={shareScheduleAction.bind(null, c.id, false)}>
                  <SubmitButton confirm={`${shopTo} に送ります。よろしいですか？`}>
                    {c.scheduleSharedAt ? `最新の内容を${shopVia}で再送` : `${shopVia}で飲食店に送る`}
                  </SubmitButton>
                </form>
              ) : (
                <p className="w-full text-xs text-muted">
                  ※ お店が公式LINEと未連携（メールも未登録）のため、自動では送れません。コピーしてあなたのLINEで送るか、
                  <Link href={`/admin/restaurants/${restaurant?.id}`} className="underline">飲食店ページ</Link>
                  から公式LINEの案内文を送って連携してもらってください。
                </p>
              )}
              <CopyButton text={scheduleText} label="文面をコピー" size="md" />
              <a href={lineShareUrl(scheduleText)} target="_blank" rel="noopener" className={buttonClass("outline")}>
                自分のLINEで送る
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

      <Card
        title="投稿前の動画チェック"
        actions={videoEnabled(c) ? <Badge tone="blue">{c.videoCheck === "owner_first" ? "あなた → お店" : "お店が直接確認"}</Badge> : <Badge>なし</Badge>}
      >
        <form action={setVideoCheck.bind(null, c.id)} className="flex flex-wrap items-end gap-3">
          <label className="block min-w-64 flex-1 text-sm">
            <span className="mb-1 block font-bold">撮影と投稿の間に、動画の確認を入れる</span>
            <select name="videoCheck" defaultValue={c.videoCheck ?? "none"} className={inputClass}>
              <option value="none">なし（撮影後そのまま投稿）</option>
              <option value="direct">A：発信者 → お店が確認</option>
              <option value="owner_first">B：発信者 → あなたが確認 → お店が確認</option>
            </select>
          </label>
          <SubmitButton variant="outline" size="sm">
            保存
          </SubmitButton>
        </form>
        {videoEnabled(c) && (
          <>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              撮影日の翌日に、発信者へ「動画を送ってください」と自動で届きます。お店には飲食店用ページで確認してもらいます（2日たっても確認がなければ1回リマインド）。
              {b.restaurant?.lineUserId || b.restaurant?.lineGroupId ? "" : " お店がLINE未連携のため、お店への連絡は各発信者の「詳細」からあなたのLINEで送れます。"}
            </p>
            {confirmed.length > 0 && (
              <ul className="mt-3 divide-y divide-line text-sm">
                {confirmed.map((r) => {
                  const st = videoStage(r.a, c);
                  return (
                    <li key={r.a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                      <b>{r.creator.name}</b>
                      <Badge tone={st === "approved" ? "green" : st === "revise" ? "red" : st === "owner_review" ? "amber" : "blue"}>{videoStageLabel[st]}</Badge>
                      {r.a.videos?.length ? <span className="text-xs text-muted">提出{r.a.videos.length}回</span> : null}
                      <Link href={`/admin/assignments/${r.a.id}`} className="ml-auto text-xs underline">
                        {st === "owner_review" ? "動画を確認する" : "詳細"}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </Card>

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
                        ) : isPosted(r.a) ? (
                          <Badge tone="green">{r.a.postedAt ? "確認済み" : "投稿済み"}</Badge>
                        ) : (
                          <form action={markPostedAction.bind(null, c.id, r.a.id)} className="flex min-w-44 flex-wrap items-center gap-1">
                            <input name="postUrl" type="url" placeholder="URL（任意）" aria-label={`${r.creator.name}さんの投稿URL`} className={`${inputClass} !w-32 !py-1 text-xs`} />
                            <button className="text-xs font-bold text-brand underline">投稿を確認した</button>
                          </form>
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
                        {!isComplete(r.a.insight) && r.a.insightRemindedAt && <span className="mt-0.5 block text-xs text-muted">リマインド済 {fmtDateTime(r.a.insightRemindedAt)}</span>}
                        {!isComplete(r.a.insight) && !c.reportSentAt && (
                          <form action={setInsightRemindAction.bind(null, c.id, r.a.id, Boolean(r.a.noInsightRemind))} className="mt-1 flex items-center gap-1.5 text-xs">
                            {r.a.noInsightRemind ? <Badge>リマインドしない</Badge> : <span className="text-muted">リマインド：する</span>}
                            <button type="submit" className="text-brand underline">
                              {r.a.noInsightRemind ? "対象に戻す" : "対象から外す"}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 rounded-xl border border-line bg-mist p-3">
              <h3 className="text-sm font-bold">DMなどで受け取ったスクショを追加する</h3>
              <p className="mt-1 text-xs text-muted">
                発信者を選んで画像を追加すると、本人が送ったときと同じように{isAiConfigured() ? "AIが数字を読み取ります" : "記録されます"}。本人への連絡はしません（足りない項目があれば、その人の「詳細」から連絡できます）。
              </p>
              <div className="mt-3">
                <AdminShotDrop
                  canAnalyze={isAiConfigured()}
                  rows={confirmed.map((r) => ({
                    id: r.a.id,
                    label: `${r.creator.name}（${isComplete(r.a.insight) ? "そろっています" : r.a.insight ? "足りない項目あり" : "未提出"}）`,
                    shots: (shotsBy.get(r.a.id) ?? []).map((s) => ({ id: s.id, url: `/api/ops/shots/${s.id}` })),
                  }))}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {notPostedDue.length > 0 && (
                <form action={markPostedBulkAction.bind(null, c.id)}>
                  <SubmitButton
                    variant="outline"
                    size="sm"
                    confirm={`投稿日を過ぎて投稿の報告がない${notPostedDue.length}名（${notPostedDue.map((r) => r.creator.name).join("、")}）を、まとめて「投稿済み」にします。投稿を確認できていますか？`}
                  >
                    投稿日を過ぎた{notPostedDue.length}名をまとめて投稿済みにする
                  </SubmitButton>
                </form>
              )}
              <form action={insightRequestAction.bind(null, c.id)}>
                <SubmitButton variant="outline" size="sm" confirm="投稿予定日を過ぎていて、まだ依頼していない人に今すぐ送ります。よろしいですか？">
                  月末を待たずに今すぐ提出をお願いする
                </SubmitButton>
              </form>
              {!c.reportSentAt && remindTargets.length > 0 && (
                <form action={insightRemindAction.bind(null, c.id)}>
                  <SubmitButton
                    variant="outline"
                    size="sm"
                    confirm={`提出をお願い済みで、まだ未提出・足りない項目がある${remindTargets.length}名（${remindTargets.map((r) => r.creator.name).join("、")}）に、今すぐリマインドを送ります。よろしいですか？`}
                  >
                    未提出・不足の{remindTargets.length}名に今すぐリマインド
                  </SubmitButton>
                </form>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">
              リマインドは、依頼から3日たつと自動でも1回送ります。今すぐリマインドは何度でも送れます。DMでやり取り中の人などは、表の「対象から外す」で自動・今すぐのどちらのリマインドからも外せます。
            </p>
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
              {shopVia && (
                <form action={sendReportAction.bind(null, c.id, false)}>
                  <SubmitButton confirm={`${shopTo} にレポートを送ります。よろしいですか？`}>{c.reportSentAt ? `${shopVia}で再送` : `${shopVia}で飲食店に送る`}</SubmitButton>
                </form>
              )}
              <CopyButton text={reportText} label="送付文をコピー" size="md" />
              <a href={lineShareUrl(reportText)} target="_blank" rel="noopener" className={buttonClass("outline")}>
                自分のLINEで送る
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
            <dt className="text-xs font-bold text-muted">撮影日時</dt>
            <dd>{isFlex(c) ? `期間と時間帯から選んでもらう：${describeFlex(c.flex!)}・同じ時間${c.flex!.capacity}名まで` : c.slots.map(fmtSlot).join("／")}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-xs font-bold text-muted">店舗のリンク</dt>
            <dd className="mt-1">
              {restaurant?.tabelogUrl || restaurant?.instagramUrl ? (
                <ShopLinks r={restaurant} />
              ) : (
                <span className="text-muted">
                  未登録（<Link href={`/admin/campaigns/${c.id}/edit`} className="underline">編集</Link>から食べログ・Instagramを登録できます）
                </span>
              )}
            </dd>
          </div>
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
      <form action={deleteCampaign.bind(null, c.id)} className="flex justify-end">
        <SubmitButton variant="danger" size="sm" confirm={`「${c.title}」と、その依頼・インサイト・スクショをすべて削除します。元に戻せません。よろしいですか？`}>
          この案件を削除
        </SubmitButton>
      </form>
    </>
  );
}
