import Image from "next/image";
import { cn } from "./cn";
import mark from "../../../public/images/brand/tabetunagu-mark.png";

/** シンボルマーク（2人と葉で「食のバトンをつなぐ」を表す） */
export function LogoMark({ className, priority }: { className?: string; priority?: boolean }) {
  return <Image src={mark} alt="" aria-hidden sizes="64px" priority={priority} className={cn("h-8 w-8 object-contain", className)} />;
}

export function Logo({ className, sub = false }: { className?: string; sub?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark priority />
      <span className="flex flex-col leading-none">
        <span className="font-en text-[15px] font-semibold tracking-[0.18em] text-ink">TABETUNAGU</span>
        {sub && <span className="mt-1 text-[10px] tracking-[0.3em] text-muted">食べつなぐ</span>}
      </span>
    </span>
  );
}
