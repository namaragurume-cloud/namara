import Image from "next/image";
import { Plus } from "lucide-react";
import { getCreatorById } from "@/data/creators";
import { comboPlan, influencerPlan, microPlan, pricingPolicy } from "@/data/pricing";
import { CTAButton } from "./CTAButton";
import { TrackedLink } from "./TrackedLink";

const card =
  "flex flex-col rounded-[24px] bg-white p-6 ring-2 ring-brand/35 shadow-[0_30px_60px_-30px_rgba(217,83,58,0.45)] md:p-9";
const condition = "mt-1 block text-sm font-semibold text-muted sm:mt-0 sm:ml-2 sm:inline";

/** 料金表（マイクロインフルエンサーの定額 3 段階＋インフルエンサーの個別見積もり＋一番のおすすめ） */
export function PricingTable() {
  const featured = influencerPlan.featuredCreatorIds.map(getCreatorById).filter((c) => c?.image);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <article className={card}>
        <p className="num text-xs font-semibold tracking-[0.25em] text-brand">{microPlan.label}</p>
        <h3 className="mt-3 text-xl font-bold">
          {microPlan.name}
          <span className={condition}>（{microPlan.condition}）</span>
        </h3>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {microPlan.options.map((o) => (
            <li key={o.people} className="relative">
              {o.recommended && (
                <span className="absolute -top-2.5 right-3 z-10 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold text-white sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
                  おすすめ
                </span>
              )}
              <TrackedLink
                href={`/contact?budget=${o.param}`}
                event="cta_click"
                params={{ location: `pricing_micro_${o.people}` }}
                className={
                  "group flex h-full items-center justify-between gap-3 rounded-2xl border px-5 py-4 transition-colors hover:border-brand/60 sm:flex-col sm:items-start sm:gap-1 sm:py-5 " +
                  (o.recommended ? "border-brand/60 bg-brand/[0.06]" : "border-line bg-cream")
                }
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
          <CTAButton href={`/contact?budget=${microPlan.options[1].param}`} fullWidth trackLocation="pricing_micro">
            マイクロインフルエンサーで相談する
          </CTAButton>
        </div>
      </article>

      <article className={card}>
        <p className="num text-xs font-semibold tracking-[0.25em] text-brand">{influencerPlan.label}</p>
        <h3 className="mt-3 text-xl font-bold">
          {influencerPlan.name}
          <span className={condition}>（{influencerPlan.condition}）</span>
        </h3>
        <p className="mt-6 text-3xl font-extrabold md:text-4xl">
          別途<span className="text-brand">お見積もり</span>
        </p>
        {featured.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="在籍インフルエンサーの例">
            {featured.map((c) => (
              <li key={c!.id} className="relative size-12 overflow-hidden rounded-full bg-mist ring-2 ring-white shadow-sm md:size-14">
                <Image src={c!.image!} alt={c!.name ?? c!.account} fill sizes="56px" className="object-cover" />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-5 border-t border-line pt-5 text-sm leading-relaxed text-muted">{influencerPlan.note}</p>
        <div className="mt-auto pt-7">
          <CTAButton href={`/contact?budget=${influencerPlan.param}`} fullWidth trackLocation="pricing_influencer">
            見積もりを相談する
          </CTAButton>
        </div>
      </article>

      <article className="bg-gradient-brand flex flex-col gap-6 rounded-[24px] p-6 text-white shadow-[0_30px_60px_-30px_rgba(217,83,58,0.6)] md:p-9 lg:col-span-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="inline-block rounded-full bg-white px-3 py-1 text-xs font-bold text-brand">{comboPlan.title}</p>
          <p className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:gap-5">
            {comboPlan.items.map((it, i) => (
              <span key={it.name} className="contents">
                {i > 0 && <Plus size={22} aria-label="＋" className="shrink-0" />}
                <span>
                  <span className="block text-lg font-bold md:text-xl">{it.name}</span>
                  <span className="block text-sm font-semibold text-white/85">{it.price}</span>
                </span>
              </span>
            ))}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/90">{comboPlan.note}</p>
        </div>
        <CTAButton href={`/contact?budget=${comboPlan.param}`} variant="dark" trackLocation="pricing_combo" className="shrink-0">
          この組み合わせで相談する
        </CTAButton>
      </article>

      <p className="text-xs text-muted lg:col-span-2">
        ※{pricingPolicy.disclaimer}
        {pricingPolicy.taxNote && <> {pricingPolicy.taxNote}</>}
      </p>
    </div>
  );
}
