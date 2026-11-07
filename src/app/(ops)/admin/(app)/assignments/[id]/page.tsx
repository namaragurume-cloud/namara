import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton, SubmitButton } from "@/components/ops/client";
import { statusLabel } from "@/components/ops/phase";
import { Badge, Card, Field, Flash, buttonClass, inputClass } from "@/components/ops/ui";
import { fmtDateTime, fmtSlot } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { assignmentUrl } from "@/lib/ops/urls";
import { ShotUploader } from "@/components/ops/ShotUploader";
import { VideoUploader } from "@/components/ops/VideoUploader";
import { VideoView } from "@/components/ops/VideoView";
import { lineShareUrl } from "@/lib/ops/line";
import { shopVideoText } from "@/lib/ops/video";
import { latestVideo, videoEnabled, videoStage, videoStageLabel } from "@/lib/ops/video-state";
import { videoStorage } from "@/lib/ops/video-store";
import { insightFields, isComplete } from "@/lib/ops/insight-fields";
import { listShots } from "@/lib/ops/insights";
import type { DistKey, MetricKey, Platform } from "@/lib/ops/types";
import { isAiConfigured } from "@/lib/ops/vision";
import { markVideoSentAction, notifyMissingAction, ownerVideoAction, saveAssignment, saveInsightManual, shopVideoAsAdmin } from "../../../actions";

export const metadata = { title: "依頼の詳細" };

export default async function AssignmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ flash?: string }> }) {
  const [{ id }, { flash }] = await Promise.all([params, searchParams]);
  const a = await db.get("assignments", id);
  if (!a) notFound();
  const [c, creator] = await Promise.all([db.get("campaigns", a.campaignId), db.get("creators", a.creatorId)]);
  if (!c || !creator) notFound();
  const url = assignmentUrl(creator, a);
  const i = a.insight;
  const shots = await listShots(a.id);
  const restaurant = await db.get("restaurants", c.restaurantId);
  const vStage = videoStage(a, c);
  const lv = latestVideo(a);
  const shopText = vStage === "shop_review" ? await shopVideoText(a.id) : null;
  const platform: Platform = i?.platform ?? a.platform ?? (/tiktok/i.test(creator.platform) ? "tiktok" : "instagram");
  return (
    <>
      <Flash text={flash} />
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
            <Field label="来店人数">
              <select name="partySize" defaultValue={String(a.partySize ?? 1)} className={inputClass}>
                <option value="1">1名（本人のみ）</option>
                <option value="2">2名（同伴1名）</option>
                <option value="3">3名（同伴2名）</option>
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
            <Field label="この人の報酬・特典" hint={`空欄なら案件の共通の報酬「${c.offer || "未設定"}」。この人にだけ表示されます（変えても本人への連絡はしません）`}>
              <input name="offer" defaultValue={a.offer} placeholder={c.offer} className={inputClass} />
            </Field>
            <Field label="本人からのメモ">
              <input name="note" defaultValue={a.note} className={inputClass} />
            </Field>
          </div>
        </Card>
        <Card title="投稿URL">
          <Field label="投稿URL">
            <input name="postUrl" type="url" defaultValue={a.postUrl} className={inputClass} />
          </Field>
        </Card>
        <SubmitButton>回答・URLを保存</SubmitButton>
      </form>

      {videoEnabled(c) && (
        <Card
          title="投稿前の動画チェック"
          actions={<Badge tone={vStage === "approved" ? "green" : vStage === "revise" ? "red" : "amber"}>{videoStageLabel[vStage]}</Badge>}
        >
          <p className="mb-3 text-xs text-muted">
            {c.videoCheck === "owner_first" ? "流れ：発信者が提出 → あなたが確認 → お店が確認" : "流れ：発信者が提出 → お店が確認"}
            {restaurant?.lineUserId ? "（お店はLINE連携済み）" : "（お店はLINE未連携：お店への連絡は下のボタンからあなたのLINEで）"}
          </p>
          {lv ? (
            <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
              <VideoView v={lv} index={(a.videos?.length ?? 1) - 1} />
              <div className="space-y-3">
                {vStage === "owner_review" && (
                  <>
                    <p className="text-sm font-bold">あなたの確認</p>
                    <form action={ownerVideoAction.bind(null, a.id, lv.id, true)}>
                      <SubmitButton size="sm">OK（お店に確認をお願いする）</SubmitButton>
                    </form>
                    <form action={ownerVideoAction.bind(null, a.id, lv.id, false)} className="space-y-2">
                      <textarea name="comment" rows={3} placeholder="発信者に伝える修正内容" className={inputClass} />
                      <SubmitButton variant="outline" size="sm">修正をお願いする（発信者へ連絡）</SubmitButton>
                    </form>
                  </>
                )}
                {vStage === "shop_review" && (
                  <>
                    <p className="text-sm">
                      お店の確認待ちです。
                      {lv.sentToShopAt ? `（お店に連絡済み ${fmtDateTime(lv.sentToShopAt)}）` : "（まだお店に連絡していません）"}
                    </p>
                    {shopText && (
                      <div className="flex flex-wrap gap-2">
                        <a href={lineShareUrl(shopText)} target="_blank" rel="noopener" className={buttonClass("outline", "sm")}>
                          お店にLINEで送る
                        </a>
                        <CopyButton text={shopText} label="文面をコピー" />
                        {!lv.sentToShopAt && (
                          <form action={markVideoSentAction.bind(null, a.id, lv.id)}>
                            <SubmitButton variant="outline" size="sm">連絡済みにする</SubmitButton>
                          </form>
                        )}
                      </div>
                    )}
                    <details className="rounded-xl bg-mist p-3">
                      <summary className="cursor-pointer text-xs font-bold">お店からLINEで返事が来たとき（代理で入力）</summary>
                      <div className="mt-2 space-y-2">
                        <form action={shopVideoAsAdmin.bind(null, a.id, lv.id, true)}>
                          <SubmitButton size="sm">お店がOK（発信者へ連絡）</SubmitButton>
                        </form>
                        <form action={shopVideoAsAdmin.bind(null, a.id, lv.id, false)} className="space-y-2">
                          <textarea name="comment" rows={2} placeholder="お店からの修正内容" className={inputClass} />
                          <SubmitButton variant="outline" size="sm">お店が修正希望（発信者へ連絡）</SubmitButton>
                        </form>
                      </div>
                    </details>
                  </>
                )}
                {vStage === "revise" && <p className="text-sm">発信者の修正待ちです。修正版が届くと、ここに表示されます。</p>}
                {vStage === "approved" && <p className="text-sm">お店のOKが出ています。投稿日に投稿されます。</p>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">まだ動画は届いていません。{a.videoRequestedAt ? `（提出のお願い：${fmtDateTime(a.videoRequestedAt)}）` : "撮影日の翌日に、発信者へ自動でお願いが届きます。"}</p>
          )}
          <div className="mt-4">
            <p className="mb-1 text-xs text-muted">DMなどで受け取った動画は、ここから代わりに追加できます。</p>
            <VideoUploader assignmentId={a.id} mode={videoStorage()} label="動画を追加する" />
          </div>
          {(a.videos?.length ?? 0) > 1 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-bold text-muted">前の提出（{a.videos!.length - 1}件）</summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {a.videos!.slice(0, -1).reverse().map((v, i) => (
                  <VideoView key={v.id} v={v} index={a.videos!.length - 2 - i} />
                ))}
              </div>
            </details>
          )}
        </Card>
      )}

      <Card
        title="インサイト（スクショ）"
        actions={i ? i.missing.length ? <Badge tone="red">足りない項目 {i.missing.length}件</Badge> : <Badge tone="green">そろっています</Badge> : <Badge>未提出</Badge>}
      >
        <p className="mb-3 text-xs text-muted">
          DMなどで受け取ったスクショはここから追加できます。{isAiConfigured() ? "追加すると自動で読み取ります。" : "（AIの読み取りが未設定のため、下の欄に手入力してください）"}
          画像は{180}日後に自動で削除されます（数値は残ります）。
        </p>
        <ShotUploader assignmentId={a.id} shots={shots.map((s) => ({ id: s.id, url: `/api/ops/shots/${s.id}` }))} canAnalyze={isAiConfigured()} />
        {shots.length > 0 && (
          <p className="mt-2 text-xs text-muted">送信元：{shots.map((s) => ({ web: "ページ", line: "LINE", admin: "管理画面" })[s.via]).join("・")}</p>
        )}
        {i?.aiNote && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">AIのメモ：{i.aiNote}</p>}
        <div className="mt-4 flex flex-wrap gap-2">

          {!isComplete(i) && a.status === "accepted" && (
            <form action={notifyMissingAction.bind(null, a.id)}>
              <SubmitButton variant="outline" size="sm" confirm="発信者に不足している項目を連絡します。よろしいですか？">
                {i ? "足りない項目を発信者に連絡" : "提出をお願いする"}
              </SubmitButton>
            </form>
          )}
          {a.missingNotifiedAt && <span className="self-center text-xs text-muted">不足の連絡：{fmtDateTime(a.missingNotifiedAt)}（{a.missingNotifiedFor || "未提出"}）</span>}
        </div>

        <form action={saveInsightManual} className="mt-6 space-y-3 border-t border-line pt-4">
          <input type="hidden" name="id" value={a.id} />
          <p className="text-sm font-bold">数値の確認・修正</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="媒体" hint="変えたら一度保存すると入力欄が切り替わります">
              <select name="platform" defaultValue={platform} className={inputClass}>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
              </select>
            </Field>
            <Field label="投稿の種類">
              <select name="isVideo" defaultValue={i?.isVideo === true ? "yes" : i?.isVideo === false ? "no" : ""} className={inputClass}>
                <option value="">不明</option>
                <option value="yes">動画（リール）</option>
                <option value="no">写真・カルーセル</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {insightFields[platform]
              .filter((f) => f.kind !== "dist")
              .map((f) => (
                <Field key={f.key} label={`${f.label}${f.kind === "seconds" ? "（秒）" : f.kind === "percent" ? "（%）" : ""}`} required={f.required}>
                  <input name={f.key} inputMode="decimal" defaultValue={i?.platform === platform ? (i.metrics[f.key as MetricKey] ?? "") : ""} className={inputClass} />
                </Field>
              ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {insightFields[platform]
              .filter((f) => f.kind === "dist")
              .map((f) => (
                <Field key={f.key} label={f.label} required={f.required} hint="1行に「項目 数値」（例：フィード 72.7）">
                  <textarea
                    name={f.key}
                    rows={6}
                    defaultValue={i?.platform === platform ? (i.dists[f.key as DistKey] ?? []).map((d) => `${d.label} ${d.pct}`).join("\n") : ""}
                    className={inputClass}
                  />
                </Field>
              ))}
          </div>
          <SubmitButton>インサイトを保存</SubmitButton>
        </form>
      </Card>
    </>
  );
}
