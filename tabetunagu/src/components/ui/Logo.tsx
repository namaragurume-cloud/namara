import { cn } from "./cn";

/** 2つの円が重なる「バトン」のマーク + ワードマーク */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("h-6 w-6", className)}>
      <circle cx="12" cy="16" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="20" cy="16" r="8.5" fill="var(--leaf)" fillOpacity="0.9" />
      <path d="M16 9.3a8.5 8.5 0 0 1 0 13.4a8.5 8.5 0 0 1 0-13.4z" fill="currentColor" />
    </svg>
  );
}

export function Logo({ className, sub = false }: { className?: string; sub?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-forest", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-en text-[15px] font-semibold tracking-[0.18em] text-ink">TABETUNAGU</span>
        {sub && <span className="mt-1 text-[10px] tracking-[0.3em] text-muted">食べつなぐ</span>}
      </span>
    </span>
  );
}
