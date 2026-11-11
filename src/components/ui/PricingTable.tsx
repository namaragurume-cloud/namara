import { influencerPlan, microPlan, pricingPolicy } from "@/data/pricing";
import { CTAButton } from "./CTAButton";
import { TrackedLink } from "./TrackedLink";

/** 料金表（マイクロインフルエンサーの定額 3 段階＋インフルエンサーの個別見積もり） */
export function PricingTable() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <article className="flex flex-col rounded-[24px] bg-white p-6 ring-2 ring-brand/35 shadow-[0_30px_60px_-30px_rgba(217,83,58,0.45)] md:p-9">
        <p className="num text-xs font-semibold tracking-[0.25em] text-brand">{microPlan.label}</p>
        <h3 className="mt-3 text-xl font-bold">
          {microPlan.name}
          <span className="mt-1 block text-sm font-semibold text-muted sm:mt-0 sm:ml-2 sm:inline">（{microPlan.condition}）</span>
        </h3>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {microPlan.options.map((o) => (
            <li key={o.people}>
              <TrackedLink
                href={`/contact?budget=${o.param}`}
                event="cta_click"
                params={{ location: `pricing_micro_${o.people}` }}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-cream px-5 py-4 transition-colors hover:border-brand/50 sm:flex-col sm:items-start sm:gap-1 sm:py-5"
              >
                <span className="text-sm font-bold">{o.people}名調整</span>
                <span className="flex items-baseline gap-0.5 font-extrabold text-brand">
                  <span className="num text-4xl">{o.price}</span>
                  <span className="text-base">万円</span>
                </span>
              </TrackedLink>
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-line pt-5 text-sm font-semibold">{microPlan.suitedFor}</p>
        <div className="mt-auto pt-7">
          <CTAButton href={`/contact?budget=${microPlan.options[0].param}`} fullWidth trackLocation="pricing_micro">
            マイクロインフルエンサーで相談する
          </CTAButton>
        </div>
      </article>

      <article className="flex flex-col rounded-[24px] border border-line bg-white p-6 md:p-9">
        <p className="num text-xs font-semibold tracking-[0.25em] text-brand">{influencerPlan.label}</p>
        <h3 className="mt-3 text-xl font-bold">
          {influencerPlan.name}
          <span className="mt-1 block text-sm font-semibold text-muted sm:mt-0 sm:ml-2 sm:inline">（{influencerPlan.condition}）</span>
        </h3>
        <p className="mt-6 text-3xl font-extrabold md:text-4xl">
          別途<span className="text-brand">お見積もり</span>
        </p>
        <p className="mt-5 border-t border-line pt-5 text-sm leading-relaxed text-muted">{influencerPlan.note}</p>
        <div className="mt-auto pt-7">
          <CTAButton href={`/contact?budget=${influencerPlan.param}`} variant="dark" fullWidth trackLocation="pricing_influencer">
            見積もりを相談する
          </CTAButton>
        </div>
      </article>

      <p className="text-xs text-muted lg:col-span-2">
        ※{pricingPolicy.disclaimer}
        {pricingPolicy.taxNote && <> {pricingPolicy.taxNote}</>}
      </p>
    </div>
  );
}
