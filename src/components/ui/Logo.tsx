import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * MIRATSUMU のロゴ（シンボル＋ワードマーク）。
 * 画像は public/images/brand/ にあります。差し替える場合は同じファイル名で上書きしてください。
 * light: 暗い背景用（黒い部分が白になったバージョン）
 */
export function Logo({ light, className, showSub = true }: { light?: boolean; className?: string; showSub?: boolean }) {
  const v = light ? "-white" : "";
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Image
        src={`/images/brand/miratsumu-symbol${v}.png`}
        alt=""
        width={235}
        height={212}
        priority
        className="h-9 w-auto md:h-10"
      />
      <span className="flex flex-col gap-1">
        <Image
          src={`/images/brand/miratsumu-wordmark${v}.png`}
          alt="MIRATSUMU（ミラツム）"
          width={395}
          height={42}
          priority
          className="h-[14px] w-auto md:h-[16px]"
        />
        {showSub && (
          <span className={cn("text-[9px] leading-none font-semibold tracking-[0.12em]", light ? "text-white/60" : "text-muted")}>
            運営：なまらグルメ
          </span>
        )}
      </span>
    </span>
  );
}
