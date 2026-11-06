import Link from "next/link";
import { notFound } from "next/navigation";
import { opsTemplates } from "@/data/ops-templates";
import { CopyButton, SubmitButton } from "@/components/ops/client";
import { statusLabel, statusTone } from "@/components/ops/phase";
import { Badge, Card, Field, Flash, inputClass } from "@/components/ops/ui";
import { fmtDate } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { isLineConfigured, lineOaMessageUrl } from "@/lib/ops/line";
import { creatorPortalUrl } from "@/lib/ops/urls";
import { resetCreatorToken, saveCreator, setCreatorActive, unlinkLine } from "../../../actions";

export const metadata = { title: "発信者の詳細" };

export default async function CreatorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ flash?: string }> }) {
  const [{ id }, { flash }] = await Promise.all([params, searchParams]);
  const c = await db.get("creators", id);
  if (!c) notFound();
  const [assignments, campaigns, restaurants] = await Promise.all([db.list("assignments"), db.list("campaigns"), db.list("restaurants")]);
  const mine = assignments.filter((a) => a.creatorId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const cMap = new Map(campaigns.map((x) => [x.id, x]));
  const rMap = new Map(restaurants.map((x) => [x.id, x.name]));
  const portal = creatorPortalUrl(c);
  const lineUrl = lineOaMessageUrl(`連携 ${c.lineLinkCode}`);
  const onboarding = opsTemplates.creatorOnboarding({ creator: c.name, code: c.lineLinkCode, lineUrl, portalUrl: portal }).text;

  return (
    <>
      <Flash text={flash} />
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/creators" className="text-sm text-muted">
          ← 発信者
        </Link>
        <h1 className="text-xl font-extrabold md:text-2xl">{c.name}</h1>
        {c.lineUserId ? <Badge tone="green">LINE連携済</Badge> : <Badge tone="amber">LINE未連携</Badge>}
        {!c.active && <Badge>依頼対象外</Badge>}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="連絡先・専用ページ">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-bold text-muted">専用ページ（依頼の一覧・回答・インサイト入力）</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2 break-all">
                <a href={portal} target="_blank" className="text-brand underline">
                  {portal}
                </a>
                <CopyButton text={portal} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">LINE連携コード</dt>
              <dd className="num mt-1 text-lg font-extrabold tracking-widest">{c.lineLinkCode}</dd>
              {!isLineConfigured() && <dd className="text-xs text-amber-700">※ 公式LINEの設定（設定ページ参照）がまだのため、自動送信はメールのみです</dd>}
            </div>
          </dl>
          {!c.lineUserId && (
            <div className="mt-4 rounded-xl bg-mist p-3">
              <p className="text-xs font-bold">最初の案内文（DMなどで1回だけ送ってください）</p>
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs leading-relaxed">{onboarding}</pre>
              <div className="mt-2">
                <CopyButton text={onboarding} label="案内文をコピー" />
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {c.lineUserId && (
              <form action={unlinkLine.bind(null, c.id)}>
                <SubmitButton variant="outline" size="sm" confirm="LINE連携を解除しますか？">
                  LINE連携を解除
                </SubmitButton>
              </form>
            )}
            <form action={resetCreatorToken.bind(null, c.id)}>
              <SubmitButton variant="outline" size="sm" confirm="専用ページのURLを作り直しますか？（古いURLは使えなくなります）">
                専用ページのURLを作り直す
              </SubmitButton>
            </form>
            <form action={setCreatorActive.bind(null, c.id, !c.active)}>
              <SubmitButton variant={c.active ? "danger" : "outline"} size="sm">
                {c.active ? "依頼対象から外す" : "依頼対象に戻す"}
              </SubmitButton>
            </form>
          </div>
        </Card>

        <Card title="登録内容">
          <form action={saveCreator} className="space-y-3">
            <input type="hidden" name="id" value={c.id} />
            <Field label="名前（呼び名）" required>
              <input name="name" defaultValue={c.name} required className={inputClass} />
            </Field>
            <Field label="アカウント">
              <input name="account" defaultValue={c.account} className={inputClass} />
            </Field>
            <Field label="SNS">
              <input name="platform" defaultValue={c.platform} className={inputClass} />
            </Field>
            <Field label="フォロワー数">
              <input name="followers" inputMode="numeric" defaultValue={c.followers ?? ""} className={inputClass} />
            </Field>
            <Field label="メールアドレス">
              <input name="email" type="email" defaultValue={c.email ?? ""} className={inputClass} />
            </Field>
            <Field label="メモ（本人には表示されません）">
              <textarea name="memo" rows={3} defaultValue={c.memo ?? ""} className={inputClass} />
            </Field>
            <SubmitButton>保存</SubmitButton>
          </form>
        </Card>
      </div>

      <Card title="これまでの依頼">
        {mine.length === 0 ? (
          <p className="text-sm text-muted">まだ依頼はありません。</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {mine.map((a) => {
              const camp = cMap.get(a.campaignId);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <Link href={`/admin/campaigns/${a.campaignId}`} className="font-bold hover:text-brand">
                    {rMap.get(camp?.restaurantId ?? "") ?? "-"}
                  </Link>
                  <span className="text-muted">{camp?.title}</span>
                  <Badge tone={statusTone[a.status]}>{statusLabel[a.status]}</Badge>
                  {a.insight ? <Badge tone="green">インサイト提出済</Badge> : a.status === "accepted" ? <Badge>インサイト未</Badge> : null}
                  <span className="ml-auto text-xs text-muted">{fmtDate(a.createdAt.slice(0, 10))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
