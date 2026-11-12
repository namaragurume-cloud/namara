import Link from "next/link";
import { CheckAll, SubmitButton } from "@/components/ops/client";
import { CreatorAvatar } from "@/components/ops/CreatorAvatar";
import { BudgetPicker } from "@/components/ops/BudgetPicker";
import { MicroPicker } from "@/components/ops/proposal/MicroPicker";
import { SelectedTotal } from "@/components/ops/SelectedTotal";
import { creatorIconUrl } from "@/lib/ops/creator-profile";
import { Badge, Card, Empty, Field, Flash, inputClass } from "@/components/ops/ui";
import { fmtDate, fmtNum } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { buildPlan, isMicro, microReachPerPerson, yen } from "@/lib/ops/proposal";
import { proposalSettings } from "@/lib/ops/proposal-store";
import { fmtReach } from "@/lib/ops/reach";
import { reachEstimates } from "@/lib/ops/reach-store";
import { createProposal } from "../../actions";

export const metadata = { title: "提案" };

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ flash?: string; restaurant?: string }> }) {
  const { flash, restaurant } = await searchParams;
  const [proposals, restaurants, creators, settings, reach] = await Promise.all([db.list("proposals"), db.list("restaurants"), db.list("creators"), proposalSettings(), reachEstimates()]);
  const rMap = new Map(restaurants.map((r) => [r.id, r.name]));
  const cMap = new Map(creators.map((c) => [c.id, c]));
  const active = creators.filter((c) => c.active).sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));
  const microPer = microReachPerPerson(creators, reach);
  const list = proposals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <Flash text={flash} />
      <h1 className="text-xl font-extrabold md:text-2xl">飲食店への提案</h1>
      <p className="text-sm text-muted">発信者を選ぶだけで、設定した料金から料金表を自動で作ります。URLを送ると、お店は料金表を見てPDFで保存できます。</p>

      <Card title="新しい提案をつくる">
        <form id="proposal-form" action={createProposal} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="提案するお店">
              <select name="restaurantId" defaultValue={restaurant ?? ""} className={inputClass}>
                <option value="">（下に新しい店舗名を入力）</option>
                {restaurants
                  .sort((a, b) => a.name.localeCompare(b.name, "ja"))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="まだ登録していないお店なら、店舗名" hint="入力すると飲食店として登録されます">
              <input name="newRestaurant" placeholder="例：らーめん 北のいち" className={inputClass} />
            </Field>
          </div>
          <Field label="メモ（任意・お店には見えません）" hint="例：12月の新メニュー「味噌バター」を若い女性に広めたい">
            <textarea name="request" rows={2} className={inputClass} />
          </Field>
          <MicroPicker perPerson={microPer} />
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">指定するアカウント（フォロワー1万人以上）</p>
              <CheckAll formId="big-creators" name="creatorId" />
            </div>
            {[
              { key: "big", list: active.filter((c) => !isMicro(c)) },
              { key: "micro", list: active.filter(isMicro) },
            ].map((g) =>
              g.list.length === 0 ? null : (
                <details key={g.key} id={g.key === "big" ? "big-creators" : undefined} open={g.key === "big"} className={g.key === "micro" ? "mt-3" : undefined}>
                  {g.key === "micro" && <summary className="cursor-pointer text-sm font-bold">フォロワー1万人未満の発信者を個別に指定する場合（{g.list.length}名）</summary>}
                  {g.key === "big" && <summary className="sr-only">フォロワー1万人以上</summary>}
                  <div className="mt-2 grid max-h-96 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                    {g.list.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                      <input type="checkbox" name="creatorId" value={c.id} data-price={c.price ?? 0} data-reach={reach.get(c.id)?.value ?? 0} className="size-4 accent-[var(--brand)]" />
                      <CreatorAvatar name={c.name} src={creatorIconUrl(c)} size={28} />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate">{c.name}</b>
                        <span className="block truncate text-xs text-muted">
                          {c.platform}
                          {c.followers ? `・${fmtNum(c.followers)}人` : ""}
                        </span>
                        <span className="block truncate text-xs text-emerald-700">
                          {reach.get(c.id) ? `予想リーチ 約${fmtReach(reach.get(c.id)!.value)}人${reach.get(c.id)!.basis === "followers" ? "（参考値）" : ""}` : "予想リーチ：実績なし"}
                        </span>
                      </span>
                      {c.price ? <span className="num shrink-0 text-xs font-bold">{fmtNum(c.price)}円</span> : <Badge tone="amber">料金未設定</Badge>}
                    </label>
                    ))}
                  </div>
                </details>
              ),
            )}
          </div>
          <SelectedTotal formId="proposal-form" />
          <BudgetPicker formId="proposal-form" taxRate={settings.taxRate} fixedFee={settings.directionFee} />
          <p className="text-xs text-muted">
            消費税{settings.taxRate}%{settings.directionFee ? `・${settings.directionFeeLabel} ${yen(settings.directionFee)}` : ""}は自動で加えます（設定から変更できます）。
          </p>
          <SubmitButton>料金表をつくる</SubmitButton>
        </form>
      </Card>

      <Card title="これまでの提案">
        {list.length === 0 ? (
          <Empty>まだ提案はありません。</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((p) => {
              const plan = buildPlan(p.creatorIds.map((id) => cMap.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c)), settings, undefined, { people: p.microPeople });
              return (
                <li key={p.id}>
                  <Link href={`/admin/proposals/${p.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 hover:opacity-80">
                    <b>{rMap.get(p.restaurantId) ?? "（店舗不明）"}</b>
                    {p.request && <span className="truncate text-sm text-muted">{p.request}</span>}
                    <span className="num text-xs text-muted">
                      {p.microPeople ? `マイクロ${p.microPeople}名＋` : ""}
                      {p.creatorIds.length}名・{yen(plan.total)}（税込）
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      {p.campaignId ? <Badge tone="green">案件化済み</Badge> : p.sentAt ? <Badge tone="blue">送付済み</Badge> : <Badge>下書き</Badge>}
                      <span className="text-xs text-muted">{fmtDate(p.createdAt.slice(0, 10))}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
