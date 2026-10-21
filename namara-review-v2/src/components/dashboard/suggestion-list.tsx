import { Lightbulb, TrendingUp, TriangleAlert } from "lucide-react";

import type { Suggestion } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const STYLE = {
  high: { icon: TriangleAlert, className: "bg-destructive-soft text-destructive", label: "優先度：高" },
  medium: { icon: Lightbulb, className: "bg-warning-soft text-warning", label: "優先度：中" },
  info: { icon: TrendingUp, className: "bg-brand-soft text-brand", label: "強み" },
} as const;

export function SuggestionList({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">分析に必要な口コミがまだありません。</p>;
  }
  return (
    <ul className="space-y-3">
      {suggestions.map((s) => {
        const style = STYLE[s.severity];
        return (
          <li key={s.id} className="flex gap-3 rounded-lg border p-3">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", style.className)}>
              <style.icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                <span className="sr-only">{style.label}：</span>
                {s.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
