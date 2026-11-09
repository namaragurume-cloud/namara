import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton, SubmitButton } from "@/components/ops/client";
import { PlanTable } from "@/components/ops/proposal/PlanTable";
import { Badge, ButtonLink, Card, Field, Flash, buttonClass, inputClass } from "@/components/ops/ui";
import { fmtDateLong, fmtDateTime, fmtNum } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { isEmailConfigured } from "@/lib/ops/email";
import { isLineConfigured, lineShareUrl } from "@/lib/ops/line";
import { buildPlan } from "@/lib/ops/proposal";
import { proposalShareMsg, proposalUrl, proposalValidUntil } from "@/lib/ops/proposal-msg";
import { proposalSettings } from "@/lib/ops/proposal-store";
import type { Creator } from "@/lib/ops/types";
import { deleteProposal, regenerateProposal, saveProposalCreators, saveProposalText, sendProposal } from "../../../actions";

export const metadata = { title: "提案" };

export default async function ProposalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ flash?: string }> }) {
  const [{ id }, { flash }] = await Promise.all([params, searchParams]);
  const p = await db.get("proposals", id);
  if (!p) notFound();
  const [r, allCreators, settings] = await Promise.all([db.get("restaurants", p.restaurantId), db.list("creators"), proposalSettings()]);
  const cMap = new Map(allCreators.map((c) => [c.id, c]));
  const creators = p.creatorIds.map((cid) => cMap.get(cid)).filter((c): c is Creator => Boolean(c));
  const plan = buildPlan(creators, settings);
  const light = p.text?.lightPlan ? buildPlan(creators.filter((c) => p.text!.lightPlan!.creatorIds.includes(c.id)), settings) : null;
  const t = p.text;
  const shareText = r ? (await proposalShareMsg(p, r)).text : "";
  const shopLine = isLineConfigured() && Boolean(r?.lineGroupId || r?.lineUserId);
  const shopVia = shopLine ? (r?.lineGroupId ? "公式LINE（お店のグループ）" : "公式LINE") : isEmailConfigured() && r?.email ? "メール" : null;
  const url = proposalUrl(p);
  const active = allCreators.filter((c) => c.active || p.creatorIds.includes(c.id)).sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));

  return (
    <>
      <Flash text={flash} />
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link href="/admin/proposals" className="text-sm text-muted">
            ← 提案
          </Link>
          <h1 className="text-xl font-extrabold md:text-2xl">{t?.title ?? `${r?.name}様への提案`}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Link href={`/admin/restaurants/${r?.id}`} className="font-bold hover:text-brand">
              {r?.name}
            </Link>
            {p.campaignId ? <Badge tone="green">案件化済み</Badge> : p.sentAt ? <Badge tone="blue">送付済み {fmtDateTime(p.sentAt)}</Badge> : <Badge>下書き</Badge>}
            有効期限 {fmtDateLong(await proposalValidUntil(p))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/proposal/${p.shareToken}`} target="_blank" variant="dark" size="sm">
            提案資料を見る
          </ButtonLink>
          {p.campaignId ? (
            <ButtonLink href={`/admin/campaigns/${p.campaignId}`} variant="outline" size="sm">
              案件を開く
            </ButtonLink>
          ) : (
            <ButtonLink href={`/admin/campaigns/new?restaurant=${p.restaurantId}&proposal=${p.id}`} size="sm">
              この提案で案件をつくる
            </ButtonLink>
          )}
        </div>
      </div>

      {plan.missingPrice.length > 0 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          料金が未設定の発信者がいます（{plan.missingPrice.map((c) => c.name).join("、")}）。料金表では0円になるので、
          {plan.missingPrice.map((c, i) => (
            <span key={c.id}>
              {i > 0 && "・"}
              <Link href={`/admin/creators/${c.id}`} className="font-bold underline">
                {c.name}
              </Link>
            </span>
          ))}
          のページで設定してください。
        </p>
      )}

      <Card title="飲食店に送る">
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-mist p-3 text-xs leading-relaxed">{shareText}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          {shopVia ? (
            <form action={sendProposal.bind(null, p.id, false)}>
              <SubmitButton confirm={`お店の${shopVia}に提案を送ります。よろしいですか？`}>{p.sentAt ? `${shopVia}で再送` : `${shopVia}で飲食店に送る`}</SubmitButton>
            </form>
          ) : (
            <p className="w-full text-xs text-muted">※ お店が公式LINE未連携（メールも未登録）のため、コピーしてあなたのLINEで送ってください。</p>
          )}
          <CopyButton text={shareText} label="文面をコピー" size="md" />
          <a href={lineShareUrl(shareText)} target="_blank" rel="noopener" className={buttonClass("outline")}>
            自分のLINEで送る
          </a>
          {!p.sentAt && (
            <form action={sendProposal.bind(null, p.id, true)}>
              <SubmitButton variant="outline">送付済みにする</SubmitButton>
            </form>
          )}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          提案資料のURL：<span className="break-all">{url}</span>
          <CopyButton text={url} label="URLをコピー" />
        </p>
      </Card>

      <Card title="料金（自動計算）">
        <PlanTable plan={plan} title={light ? "おすすめプラン" : "ご提案プラン"} taxRate={settings.taxRate} />
        {light && (
          <div className="mt-6">
            <PlanTable plan={light} title="ライトプラン" taxRate={settings.taxRate} />
            {t?.lightPlan?.reason && <p className="mt-2 text-xs text-muted">{t.lightPlan.reason}</p>}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">料金は各発信者の設定（税別）と「設定」の消費税・固定費から計算しています。AIは料金を書きません。</p>
      </Card>

      <Card
        title="提案資料の文章"
        actions={
          <form action={regenerateProposal.bind(null, p.id)}>
            <SubmitButton variant="outline" size="sm" confirm="今の文章をAIで作り直します。よろしいですか？">
              AIで作り直す
            </SubmitButton>
          </form>
        }
      >
        <form action={saveProposalText.bind(null, p.id)} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="タイトル">
              <input name="title" defaultValue={t?.title} className={inputClass} />
            </Field>
            <Field label="ひとこと（表紙）">
              <input name="catchcopy" defaultValue={t?.catchcopy} className={inputClass} />
            </Field>
          </div>
          <Field label="概要">
            <textarea name="summary" rows={3} defaultValue={t?.summary} className={inputClass} />
          </Field>
          <Field label="提案のポイント" hint="1行に1つ「見出し｜説明」">
            <textarea name="points" rows={4} defaultValue={t?.points.map((x) => `${x.title}｜${x.body}`).join("\n")} className={inputClass} />
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-bold">発信者ごとのおすすめ理由</p>
            {creators.map((c) => (
              <label key={c.id} className="grid gap-1 text-sm md:grid-cols-[10rem_1fr] md:items-start">
                <span className="font-bold">
                  {c.name}
                  <span className="block text-xs font-normal text-muted">
                    {c.followers ? `${fmtNum(c.followers)}人` : ""} {c.price ? `・${fmtNum(c.price)}円` : ""}
                  </span>
                </span>
                <textarea name={`reason_${c.id}`} rows={2} defaultValue={t?.reasons[c.id]} className={inputClass} />
              </label>
            ))}
          </div>
          {creators.length >= 2 && (
            <fieldset className="rounded-xl border border-line p-3">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" name="useLight" defaultChecked={Boolean(t?.lightPlan)} className="accent-[var(--brand)]" />
                ライトプラン（人数を絞った安いプラン）も載せる
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {creators.map((c) => (
                  <label key={c.id} className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-sm">
                    <input type="checkbox" name="lightId" value={c.id} defaultChecked={t?.lightPlan?.creatorIds.includes(c.id)} className="accent-[var(--brand)]" />
                    {c.name}
                  </label>
                ))}
              </div>
              <input name="lightReason" defaultValue={t?.lightPlan?.reason} placeholder="ライトプランの説明（例：フォロワーの多い2名で、予算を抑えたプランです）" className={`${inputClass} mt-2`} />
            </fieldset>
          )}
          <SubmitButton>文章を保存</SubmitButton>
        </form>
      </Card>

      <Card title="発信者を変える（変えるとAIで資料を作り直します）">
        <form action={saveProposalCreators.bind(null, p.id)} className="space-y-3">
          <div className="grid max-h-72 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {active.map((c) => (
              <label key={c.id} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                <input type="checkbox" name="creatorId" value={c.id} defaultChecked={p.creatorIds.includes(c.id)} className="size-4 accent-[var(--brand)]" />
                <b className="min-w-0 flex-1 truncate">{c.name}</b>
                <span className="num text-xs text-muted">{c.price ? `${fmtNum(c.price)}円` : "料金未設定"}</span>
              </label>
            ))}
          </div>
          <Field label="提案のメモ">
            <textarea name="request" rows={2} defaultValue={p.request} className={inputClass} />
          </Field>
          <SubmitButton variant="outline" size="sm" confirm="発信者を変えて、AIで資料を作り直します。今の文章の編集は消えます。よろしいですか？">
            発信者を変えて作り直す
          </SubmitButton>
        </form>
      </Card>

      <form action={deleteProposal.bind(null, p.id)} className="flex justify-end">
        <SubmitButton variant="danger" size="sm" confirm="この提案を削除します。よろしいですか？">
          この提案を削除
        </SubmitButton>
      </form>
    </>
  );
}
