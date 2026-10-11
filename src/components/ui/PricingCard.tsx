import { Check } from "lucide-react";
import type { Plan } from "@/data/pricing";
import { cn } from "@/lib/utils";

export function PricingCard({ plan, featured }: { plan: Plan; featured?: boolean }) {
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-[24px] p-7 transition-all duration-500 ease-out-expo hover:-translate-y-1.5 md:p-9",
        featured
          ? "bg-ink text-white hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]"
          : "border border-line bg-white hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.25)]",
      )}
    >
      <p className={cn("num text-xs font-semibold tracking-[0.25em]", featured ? "text-white/60" : "text-brand")}>
        {plan.label}
      </p>
      <h3 className="mt-3 text-xl font-bold leading-relaxed">{plan.name}</h3>
      <p className={cn("mt-3 text-sm leading-[1.95]", featured ? "text-white/70" : "text-muted")}>
        {plan.description}
      </p>

      <div className={cn("my-7 border-y py-6", featured ? "border-white/15" : "border-line")}>
        <p className="text-xs font-semibold opacity-60">料金</p>
        <p className="mt-1 text-2xl font-extrabold">{plan.price || "個別見積もり"}</p>
        {plan.priceNote && (
          <p className={cn("mt-2 text-xs", featured ? "text-white/60" : "text-muted")}>{plan.priceNote}</p>
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
    </article>
  );
}
