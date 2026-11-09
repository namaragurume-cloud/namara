import type { Restaurant } from "@/lib/ops/types";
import { cn } from "@/lib/utils";
import { buttonClass } from "./ui";

/** 店舗の食べログ・Instagramへのリンク */
export function ShopLinks({ r, className }: { r: Pick<Restaurant, "tabelogUrl" | "instagramUrl"> | null; className?: string }) {
  if (!r?.tabelogUrl && !r?.instagramUrl) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {r.tabelogUrl && (
        <a href={r.tabelogUrl} target="_blank" rel="noopener" className={buttonClass("outline", "sm")}>
          食べログを見る ↗
        </a>
      )}
      {r.instagramUrl && (
        <a href={r.instagramUrl} target="_blank" rel="noopener" className={buttonClass("outline", "sm")}>
          お店のInstagram ↗
        </a>
      )}
    </div>
  );
}
