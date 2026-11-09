import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarCheck, Camera, ClipboardList, FileBarChart, Lightbulb, Send, Users } from "lucide-react";
import { PrintButton } from "@/components/ops/client";
import { DemoBanner } from "@/components/ops/DemoBanner";
import { PlanTable } from "@/components/ops/proposal/PlanTable";
import { Panel, Slide, compact } from "@/components/ops/report/parts";
import { site } from "@/data/site";
import { creatorTrack } from "@/lib/ops/ai-proposal";
import { isAdmin } from "@/lib/ops/auth";
import { fmtDateLong } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { buildPlan } from "@/lib/ops/proposal";
import { proposalValidUntil } from "@/lib/ops/proposal-msg";
import { findProposalByToken, proposalSettings } from "@/lib/ops/proposal-store";
import type { Creator } from "@/lib/ops/types";

export const metadata = { title: "ご提案資料", robots: { index: false, follow: false } };

const PRINT_CSS = `
@page { size: 297mm 167.06mm; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .report-slide { width: 297mm !important; max-width: none !important; height: 167.06mm !important; aspect-ratio: auto !important;
    border: 0 !important; border-radius: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
  .report-slide:last-child { break-after: auto; page-break-after: auto; }
}`;

const FLOW = [
  { icon: <ClipboardList className="size-5" />, title: "お申し込み", body: "プランと発信者を確定します" },
  { icon: <CalendarCheck className="size-5" />, title: "日程調整", body: "撮影日をこちらで調整し、ご連絡します" },
  { icon: <Camera className="size-5" />, title: "撮影・来店", body: "発信者がお店に伺い撮影します" },
  { icon: <Send className="size-5" />, title: "投稿", body: "各発信者のSNSに投稿します" },
  { icon: <FileBarChart className="size-5" />, title: "レポート", body: "投稿の反響をまとめてご報告します" },
];

const per = 6;

export default async function ProposalDoc({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await findProposalByToken(token);
  if (!p) notFound();
  const [r, all, settings, admin] = await Promise.all([db.get("restaurants", p.restaurantId), db.list("creators"), proposalSettings(), isAdmin()]);
  const cMap = new Map(all.map((c) => [c.id, c]));
  const creators = p.creatorIds.map((id) => cMap.get(id)).filter((c): c is Creator => Boolean(c));
  const plan = buildPlan(creators, settings);
  const lightCreators = p.text?.lightPlan ? creators.filter((c) => p.text!.lightPlan!.creatorIds.includes(c.id)) : [];
  const light = lightCreators.length > 0 && lightCreators.length < creators.length ? buildPlan(lightCreators, settings) : null;
  const stats = await creatorTrack(creators.map((c) => c.id));
  const t = p.text;
  const title = t?.title ?? `${r?.name ?? ""}様 SNSプロモーションのご提案`;
  const pages = [];
  for (let i = 0; i < creators.length; i += per) pages.push(creators.slice(i, i + per));
  const total = 2 + (t?.points.length ? 1 : 0) + pages.length + 1 + 1;
  let n = 1; // 表紙が1枚目
  const created = p.createdAt.slice(0, 10);

  return (
    <>
      <DemoBanner who="restaurant" />
      <div className="mx-auto max-w-[1148px] space-y-6 px-4 py-6 print:max-w-none print:space-y-0 print:p-0">
        <style>{PRINT_CSS}</style>
        {admin && !p.sentAt && <p className="rounded-xl bg-amber-100 px-4 py-2 text-xs text-amber-900 print:hidden">管理者として表示中です（まだ飲食店には送っていません）。</p>}
        <div className="flex justify-end print:hidden">
          <PrintButton />
        </div>

        {/* 表紙 */}
        <section className="report-slide relative mx-auto flex w-full max-w-[1100px] flex-col justify-between overflow-hidden rounded-2xl border border-line bg-[#14213a] p-8 text-white shadow-sm md:aspect-[16/9] md:p-14">
          <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-[#1f5fbf]/40" />
          <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 size-96 rounded-full bg-[#2a78d6]/20" />
          <p className="relative text-lg font-bold">{r?.name} 御中</p>
          <div className="relative my-10">
            <p className="text-sm tracking-widest text-white/70">PROPOSAL</p>
            <h1 className="mt-2 text-[clamp(1.6rem,3.6vw,2.8rem)] font-extrabold leading-tight">{title}</h1>
            {t?.catchcopy && <p className="mt-4 text-[clamp(1rem,1.6vw,1.25rem)] text-white/85">{t.catchcopy}</p>}
          </div>
          <div className="relative flex flex-wrap items-end justify-between gap-4 text-sm">
            <div className="text-white/75">
              <p>作成日 {fmtDateLong(created)}</p>
              <p>有効期限 {fmtDateLong(await proposalValidUntil(p))}</p>
            </div>
            <div className="flex items-center gap-3">
              <Image src="/images/brand/miratsumu-symbol.png" alt="" width={36} height={36} className="size-9 rounded-md bg-white p-1" />
              <b>{site.company.name}</b>
            </div>
          </div>
        </section>
        {/* 概要 */}
        <Slide page={++n} total={total} title={title}>
          <div className="grid h-full gap-5 md:grid-cols-[1.3fr_1fr]">
            <Panel title="ご提案の概要" icon={<Lightbulb className="size-4" />}>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{t?.summary ?? "発信者が実際にお店に伺い、料理やお店の魅力をSNSで発信します。"}</p>
            </Panel>
            <div className="grid content-start gap-3">
              <Fact label="発信者" value={`${creators.length}名`} />
              {plan.followers > 0 && <Fact label="フォロワー合計" value={`${compact(plan.followers)}人`} />}
              <Fact label={light ? "おすすめプラン（税込）" : "お見積り（税込）"} value={`${plan.total.toLocaleString("ja-JP")}円`} />
            </div>
          </div>
        </Slide>

        {t?.points.length ? (
          <Slide page={++n} total={total} title="提案のポイント">
            <div className="grid h-full content-start gap-4 md:grid-cols-3">
              {t.points.slice(0, 3).map((x, i) => (
                <div key={i} className="rounded-xl border border-[#e3e9f2] bg-white p-5">
                  <p className="num text-3xl font-extrabold text-[#2a78d6]">{String(i + 1).padStart(2, "0")}</p>
                  <p className="mt-2 text-lg font-bold">{x.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#4a5b70]">{x.body}</p>
                </div>
              ))}
            </div>
          </Slide>
        ) : null}

        {pages.map((list, pi) => (
          <Slide key={pi} page={++n} total={total} title={`発信者のご紹介${pages.length > 1 ? `（${pi + 1}/${pages.length}）` : ""}`}>
            <div className={`grid h-full content-start gap-3 ${list.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              {list.map((c) => {
                const s = stats.get(c.id);
                return (
                  <div key={c.id} className="flex flex-col rounded-xl border border-[#e3e9f2] bg-white p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <b className="truncate text-base">{c.name}</b>
                      <span className="shrink-0 rounded bg-[#eef3fb] px-1.5 py-0.5 text-[11px] font-bold text-[#1f5fbf]">{c.platform}</span>
                    </div>
                    {c.account && <p className="truncate text-xs text-muted">@{c.account}</p>}
                    <div className="mt-2 flex gap-4 text-xs">
                      {c.followers ? (
                        <span>
                          フォロワー <b className="num text-sm">{compact(c.followers)}</b>
                        </span>
                      ) : null}
                      {s && (
                        <span>
                          平均閲覧数 <b className="num text-sm">{compact(s.avgViews)}</b>
                          <span className="text-muted">（{s.posts}投稿）</span>
                        </span>
                      )}
                    </div>
                    {c.pitch && <p className="mt-2 text-xs leading-relaxed text-[#4a5b70]">{c.pitch}</p>}
                    {t?.reasons[c.id] && <p className="mt-auto rounded-lg bg-[#f1f5fb] px-3 py-2 pt-2 text-xs leading-relaxed">{t.reasons[c.id]}</p>}
                  </div>
                );
              })}
            </div>
          </Slide>
        ))}

        <Slide page={++n} total={total} title="料金プラン">
          <div className={`grid h-full content-start gap-4 ${light ? "md:grid-cols-2" : "md:grid-cols-[1.4fr_1fr]"}`}>
            <PlanTable plan={plan} title={light ? "おすすめプラン" : "ご提案プラン"} taxRate={settings.taxRate} compact={creators.length > 5} />
            {light ? (
              <div className="space-y-2">
                <PlanTable plan={light} title="ライトプラン" taxRate={settings.taxRate} compact />
                {t?.lightPlan?.reason && <p className="text-xs text-muted">{t.lightPlan.reason}</p>}
                <Notes notes={settings.notes} />
              </div>
            ) : null}
            {!light && <Notes notes={settings.notes} />}
          </div>
        </Slide>

        <Slide page={++n} total={total} title="進め方">
          <div className="grid h-full content-center gap-3 md:grid-cols-5">
            {FLOW.map((f, i) => (
              <div key={i} className="rounded-xl border border-[#e3e9f2] bg-white p-4 text-center">
                <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-[#eef3fb] text-[#1f5fbf]">{f.icon}</span>
                <p className="num mt-2 text-xs font-bold text-muted">STEP {i + 1}</p>
                <p className="font-bold">{f.title}</p>
                <p className="mt-1 text-xs text-[#4a5b70]">{f.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-[#4a5b70]">
            <Users className="size-4" />
            ご不明な点は、このままLINEでお気軽にご連絡ください。
          </p>
        </Slide>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e3e9f2] bg-white px-4 py-3">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="num mt-1 text-2xl font-extrabold text-[#14213a]">{value}</p>
    </div>
  );
}

function Notes({ notes }: { notes: string }) {
  if (!notes) return null;
  return (
    <div className="rounded-xl bg-[#f7f9fc] p-4 text-xs leading-relaxed text-[#4a5b70]">
      <p className="mb-1 font-bold">備考</p>
      <p className="whitespace-pre-wrap">{notes}</p>
    </div>
  );
}
