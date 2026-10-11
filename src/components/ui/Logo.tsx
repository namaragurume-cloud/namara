import { cn } from "@/lib/utils";

/**
 * ロゴ。正式ロゴの画像がある場合は public/images/brand/ に置き、
 * ここを <Image src="/images/brand/logo.svg" ... /> に差し替えてください。
 */
export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <span className={cn("flex flex-col leading-none", className)}>
      <span className={cn("text-[19px] font-black tracking-[0.06em] md:text-[21px]", light ? "text-white" : "text-ink")}>
        なまら<span className="text-brand">グルメ</span>
      </span>
      <span
        className={cn(
          "num mt-1.5 text-[8.5px] font-semibold tracking-[0.32em]",
          light ? "text-white/60" : "text-muted",
        )}
      >
        GOURMET CASTING
      </span>
    </span>
  );
}
