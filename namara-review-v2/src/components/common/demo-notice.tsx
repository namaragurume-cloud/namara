import { FlaskConical } from "lucide-react";

import { cn } from "@/lib/utils";

/** 外部連携がモックであることを明示するための注記 */
export function DemoNotice({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border border-dashed border-brand/30 bg-brand-soft/60 px-3 py-2 text-xs leading-relaxed text-primary",
        className,
      )}
    >
      <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
