import { cn } from "@/lib/utils";

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-lg text-sm font-black",
          inverted ? "bg-white text-primary" : "bg-primary text-white",
        )}
        aria-hidden
      >
        N
      </span>
      <span className="flex flex-col leading-none">
        <span className={cn("text-sm font-bold tracking-wide", inverted ? "text-white" : "text-primary")}>NAMARA REVIEW</span>
        <span className={cn("mt-1 text-[10px]", inverted ? "text-sidebar-foreground" : "text-muted-foreground")}>
          by なまらグルメ
        </span>
      </span>
    </span>
  );
}
