import { brand } from "@/lib/brand";
import { cn } from "./cn";

/** 食べつなぎ価格を主役に。通常価格は小さく添えるだけ（打ち消し線や赤い強調はしない）。 */
export function Price({
  price,
  original,
  size = "md",
  showLabel = true,
  className,
}: {
  price: number;
  original?: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}) {
  const priceSize = size === "lg" ? "text-[34px]" : size === "md" ? "text-[22px]" : "text-[18px]";
  return (
    <div className={cn("flex flex-col", className)}>
      {showLabel && <span className="text-[10px] font-semibold tracking-[0.12em] text-forest">{brand.priceLabel}</span>}
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={cn("tnum whitespace-nowrap font-semibold leading-none text-ink", priceSize)}>
          {price.toLocaleString("ja-JP")}
          <span className="ml-0.5 text-[0.5em] font-semibold">円</span>
        </span>
        {original && original > price ? (
          <span className="tnum whitespace-nowrap text-[11px] text-muted">通常 {original.toLocaleString("ja-JP")}円相当</span>
        ) : null}
      </span>
    </div>
  );
}
