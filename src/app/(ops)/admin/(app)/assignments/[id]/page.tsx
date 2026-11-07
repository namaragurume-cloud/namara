import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton, SubmitButton } from "@/components/ops/client";
import { statusLabel } from "@/components/ops/phase";
import { Badge, Card, Field, Flash, inputClass } from "@/components/ops/ui";
import { fmtDateTime, fmtSlot } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { assignmentUrl } from "@/lib/ops/urls";
import { ShotUploader } from "@/components/ops/ShotUploader";
import { insightFields, isComplete } from "@/lib/ops/insight-fields";
import { listShots } from "@/lib/ops/insights";
import type { DistKey, MetricKey, Platform } from "@/lib/ops/types";
import { isAiConfigured } from "@/lib/ops/vision";
import { notifyMissingAction, saveAssignment, saveInsightManual } from "../../../actions";

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
        <Card title="投稿URL">
          <Field label="投稿URL">
            <input name="postUrl" type="url" defaultValue={a.postUrl} className={inputClass} />
          </Field>
        </Card>
        <SubmitButton>回答・URLを保存</SubmitButton>
      </form>

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
