import { CreatorAvatar } from "@/components/ops/CreatorAvatar";
import type { Plan } from "@/lib/ops/proposal";
import { yen } from "@/lib/ops/proposal";
import { fmtReach, fmtReachRange } from "@/lib/ops/reach";

/** 料金表（明細・小計・消費税・合計） */
export function PlanTable({ plan, title, taxRate, compact }: { plan: Plan; title: string; taxRate: number; compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e3e9f2]">
      <div className="flex items-baseline justify-between gap-3 bg-[#f1f5fb] px-4 py-2.5">
        <b className="shrink-0 text-sm">{title}</b>
        <span className="text-xs text-muted">
          発信者{plan.creators.length + plan.microPeople}名
          {plan.followers ? `・${plan.microPeople ? "指定アカウントの" : ""}フォロワー合計 ${plan.followers.toLocaleString("ja-JP")}人` : ""}
        </span>
      </div>
      <table className="w-full text-sm">
        <tbody className="num">
          {plan.lines.map((l, i) => (
            <tr key={i} className="border-b border-[#eef1f5]">
              <td className={`px-4 ${compact ? "py-1.5" : "py-2"} font-sans [overflow-wrap:anywhere]`}>
                <span className="flex items-center gap-3">
                  {l.creator && <CreatorAvatar name={l.creator.name} src={l.creator.icon} size={compact ? 28 : 36} />}
                  {l.micro && (
                    <span
                      style={{ width: compact ? 28 : 36, height: compact ? 28 : 36 }}
                      className="flex shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-extrabold text-brand"
                    >
                      {l.micro.people}名
                    </span>
                  )}
                  <span className="min-w-0">
                    {l.label}
                    {l.sub && !compact && <span className="block text-xs text-muted">{l.sub}</span>}
                    {l.reach && (
                      <span className="block text-xs font-bold text-emerald-700">
                        予想リーチ 約{fmtReach(l.reach.value)}人
                        <span className="font-normal text-muted">
                          （{fmtReachRange(l.reach)}・{l.reach.basis === "history" ? `実績${l.reach.posts}投稿から` : "フォロワー数からの参考値"}）
                        </span>
                      </span>
                    )}
                    {l.micro?.reach && (
                      <span className="block text-xs font-bold text-emerald-700">
                        予想リーチ 約{fmtReach(l.micro.reach.value)}人
                        <span className="font-normal text-muted">（{fmtReachRange(l.micro.reach)}・マイクロ発信者の実績から）</span>
                      </span>
                    )}
                    {l.creator?.url && (
                      <a href={l.creator.url} target="_blank" rel="noopener" className="block text-xs text-[#1f5fbf] underline">
                        {l.creator.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                      </a>
                    )}
                  </span>
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right">{yen(l.amount)}</td>
            </tr>
          ))}
          <tr className="border-b border-[#eef1f5] text-muted">
            <td className="px-4 py-1.5 font-sans">小計（税別）</td>
            <td className="whitespace-nowrap px-4 py-1.5 text-right">{yen(plan.subtotal)}</td>
          </tr>
          <tr className="border-b border-[#eef1f5] text-muted">
            <td className="px-4 py-1.5 font-sans">消費税（{taxRate}%）</td>
            <td className="whitespace-nowrap px-4 py-1.5 text-right">{yen(plan.tax)}</td>
          </tr>
          <tr className="bg-[#1f5fbf] text-white">
            <td className="px-4 py-2.5 font-sans font-bold">合計（税込）</td>
            <td className="whitespace-nowrap px-4 py-2.5 text-right text-lg font-extrabold">{yen(plan.total)}</td>
          </tr>
          {plan.reach && (
            <>
              <tr className="bg-emerald-50">
                <td className="px-4 py-2.5 font-sans font-bold text-emerald-800">
                  予想リーチ合計
                  <span className="block text-xs font-normal text-muted">
                    {fmtReachRange(plan.reach)}
                    {plan.reach.partial &&
                      `・${[plan.reach.missingMicro ? `マイクロ${plan.microPeople}名` : "", plan.reach.missing.length ? `${plan.reach.missing.length}名` : ""].filter(Boolean).join("と")}は実績がないため含みません`}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-lg font-extrabold text-emerald-800">約{fmtReach(plan.reach.value)}人</td>
              </tr>
              {plan.costPerReach !== undefined && (
                <tr className="bg-emerald-50 text-emerald-800">
                  <td className="px-4 pb-2.5 font-sans text-xs">1リーチあたりの料金（税別）</td>
                  <td className="whitespace-nowrap px-4 pb-2.5 text-right text-sm font-bold">約{plan.costPerReach.toLocaleString("ja-JP", { maximumFractionDigits: plan.costPerReach < 10 ? 1 : 0 })}円</td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
