import { Check } from "lucide-react";
import type { Plan } from "@/data/pricing";
import { cn } from "@/lib/utils";
import { CTAButton } from "./CTAButton";

export function PricingCard({ plan, featured, showCta = true }: { plan: Plan; featured?: boolean; showCta?: boolean }) {
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-[24px] p-7 transition-all duration-500 ease-out-expo hover:-translate-y-1.5 md:p-9",
        featured
          ? "bg-white ring-2 ring-brand/35 shadow-[0_30px_60px_-30px_rgba(217,83,58,0.45)] hover:shadow-[0_30px_60px_-24px_rgba(217,83,58,0.55)]"
          : "border border-line bg-white hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.25)]",
      )}
    >
      <p className={cn("num text-xs font-semibold tracking-[0.25em]", "text-brand")}>
        {plan.label}
      </p>
      <h3 className="mt-3 text-xl font-bold leading-relaxed">{plan.name}</h3>
      <p className={cn("mt-3 text-sm leading-[1.95]", "text-muted")}>
        {plan.description}
      </p>

      <div className={cn("my-7 border-y py-6", "border-line")}>
        <p className="text-xs font-semibold opacity-60">ご予算の目安</p>
        <p className="num mt-1 text-2xl font-extrabold">{plan.budget.label}</p>
        <p className={cn("mt-1 text-xs", "text-muted")}>{plan.budget.text}</p>
        <p className="mt-5 text-xs font-semibold opacity-60">料金</p>
        <p className="mt-1 text-base font-bold">{plan.price || "個別見積もり"}</p>
        {plan.priceNote && (
          <p className={cn("mt-2 text-xs", "text-muted")}>{plan.priceNote}</p>
        )}
      </div>

      <p className="text-xs font-bold opacity-60">こんな目的に</p>
      <ul className="mt-3 space-y-2.5">
        {plan.suitedFor.map((s) => (
          <li key={s} className="flex items-start gap-2.5 text-sm">
            <Check size={16} aria-hidden="true" className="mt-1 shrink-0 text-brand" />
            {s}
          </li>
        ))}
      </ul>

      {showCta && (
        <div className="mt-auto pt-8">
          <CTAButton
            href={`/contact?budget=${plan.budget.param}`}
            variant={featured ? "primary" : "dark"}
            fullWidth
            trackLocation={`pricing_${plan.id}`}
          >
            この予算でPRを相談する
          </CTAButton>
        </div>
      )}
    </article>
  );
}
