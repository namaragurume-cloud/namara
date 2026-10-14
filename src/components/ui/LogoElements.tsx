import { brand } from "@/data/brand";
import { cn } from "@/lib/utils";

const swatch = {
  black: "bg-ink",
  red: "bg-brand",
  both: "bg-[linear-gradient(90deg,var(--ink)_50%,var(--brand)_50%)]",
} as const;

/** シンボルマークの要素と意味の一覧 */
export function LogoElements({ compact }: { compact?: boolean }) {
  return (
    <ul className={cn("grid gap-3", compact ? "sm:grid-cols-2" : "")} aria-label="シンボルマークに込めた意味">
      {brand.logo.elements.map((e) => (
        <li key={e.label} className="flex items-start gap-4 rounded-2xl bg-white px-5 py-4">
          <span aria-hidden="true" className={cn("mt-2 h-1.5 w-7 shrink-0 rounded-full", swatch[e.color])} />
          <span>
            <span className="block text-sm font-bold">{e.label}</span>
            {!compact && <span className="mt-1 block text-sm leading-relaxed text-muted">{e.text}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
