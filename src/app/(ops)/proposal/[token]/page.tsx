import Image from "next/image";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/ops/client";
import { DemoBanner } from "@/components/ops/DemoBanner";
import { PlanTable } from "@/components/ops/proposal/PlanTable";
import { site } from "@/data/site";
import { isAdmin } from "@/lib/ops/auth";
import { fmtDateLong } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { buildPlan, microReachPerPerson, yen } from "@/lib/ops/proposal";
import { fmtReach, fmtReachRange } from "@/lib/ops/reach";
import { reachEstimates } from "@/lib/ops/reach-store";
import { proposalTitle, proposalValidUntil } from "@/lib/ops/proposal-msg";
import { findProposalByToken, proposalSettings } from "@/lib/ops/proposal-store";
import type { Creator } from "@/lib/ops/types";

export const metadata = { title: "料金のご案内", robots: { index: false, follow: false } };

/** 印刷・PDF保存はA4縦1枚 */
const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
@media print {
  html, body { background: #fff !important; }
  .price-sheet { border: 0 !important; box-shadow: none !important; padding: 0 !important; }
}`;

export default async function ProposalDoc({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await findProposalByToken(token);
  if (!p) notFound();
  const [r, all, settings, admin] = await Promise.all([db.get("restaurants", p.restaurantId), db.list("creators"), proposalSettings(), isAdmin()]);
  const cMap = new Map(all.map((c) => [c.id, c]));
  const creators = p.creatorIds.map((id) => cMap.get(id)).filter((c): c is Creator => Boolean(c));
  const reach = settings.showReach !== false ? await reachEstimates() : undefined;
  const micro = { people: p.microPeople, perPerson: microReachPerPerson(all, reach) };
  const plan = buildPlan(creators, settings, reach, micro);
  const lightCreators = creators.filter((c) => p.text?.lightPlan?.creatorIds.includes(c.id));
  const light = lightCreators.length > 0 && lightCreators.length < creators.length ? buildPlan(lightCreators, settings, reach, micro) : null;
  const plans = [{ name: light ? "プランA" : "", plan }, ...(light ? [{ name: "プランB", plan: light }] : [])].filter((x) => x.plan.reach);

  return (
    <>
      <DemoBanner who="restaurant" />
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 print:max-w-none print:p-0">
        <style>{PRINT_CSS}</style>
        {admin && !p.sentAt && <p className="rounded-xl bg-amber-100 px-4 py-2 text-xs text-amber-900 print:hidden">管理者として表示中です（まだ飲食店には送っていません）。</p>}
        <div className="flex justify-end print:hidden">
          <PrintButton />
        </div>

        <article className="price-sheet space-y-6 rounded-2xl border border-line bg-white p-6 shadow-sm md:p-10">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
            <div className="min-w-0">
              <p className="text-lg font-bold">{r?.name} 御中</p>
              <h1 className="mt-2 text-xl font-extrabold md:text-2xl">{proposalTitle(p)}</h1>
            </div>
            <div className="shrink-0 text-right text-xs leading-relaxed text-muted">
              <div className="mb-1 flex items-center justify-end gap-2 text-sm font-bold text-ink">
                <Image src="/images/brand/miratsumu-symbol.png" alt="" width={24} height={24} className="size-6" />
                {site.company.name}
              </div>
              <p>作成日 {fmtDateLong(p.createdAt.slice(0, 10))}</p>
              <p>有効期限 {fmtDateLong(await proposalValidUntil(p))}</p>
            </div>
          </header>

          <PlanTable plan={plan} title={light ? "プランA" : "お見積り"} taxRate={settings.taxRate} />
          {light && (
            <div className="space-y-2">
              <PlanTable plan={light} title="プランB" taxRate={settings.taxRate} />
              {p.text?.lightPlan?.reason && <p className="text-xs text-muted">{p.text.lightPlan.reason}</p>}
            </div>
          )}

          {plans.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed">
              <p className="font-bold text-emerald-900">ご予算と予想リーチの目安</p>
              <ul className="mt-1 space-y-0.5">
                {plans.map((x) => (
                  <li key={x.name}>
                    {x.name && <b>{x.name}：</b>}
                    ご予算 <b className="num">{yen(x.plan.total)}</b>（税込）で、約<b className="num text-emerald-800">{fmtReach(x.plan.reach!.value)}人</b>
                    （{fmtReachRange(x.plan.reach!)}）へのリーチが見込まれます。
                    {x.plan.reach!.partial && <span className="text-xs text-muted">（実績のある発信者の分だけの合計で、実績のない発信者の分は含んでいません）</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                ※ 予想リーチは、各発信者がこれまでに投稿したPRのインサイト（Instagramは閲覧者数、TikTokは視聴数）から算出した推計です。
                {plan.reach!.fromFollowers > 0 && "実績のない発信者は、フォロワー数をもとにした参考値です。"}
                投稿内容や時期により変動し、成果を保証するものではありません。
              </p>
            </div>
          )}

          {settings.notes && (
            <div className="rounded-xl bg-[#f7f9fc] p-4 text-xs leading-relaxed text-[#4a5b70]">
              <p className="mb-1 font-bold">備考</p>
              <p className="whitespace-pre-wrap">{settings.notes}</p>
            </div>
          )}
        </article>
      </div>
    </>
  );
}
