import { Heart } from "lucide-react";
import { toggleFavoriteAction } from "@/app/actions/user";
import { cn } from "../ui/cn";

export function FavoriteButton({ storeId, isFavorite, next, className }: { storeId: string; isFavorite: boolean; next: string; className?: string }) {
  return (
    <form action={toggleFavoriteAction} className={className}>
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="favorite" value={isFavorite ? "0" : "1"} />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        aria-pressed={isFavorite}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-semibold transition-colors",
          isFavorite ? "border-forest/30 bg-leaf-soft text-forest" : "border-line bg-paper text-ink-2 hover:bg-canvas",
        )}
      >
        <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} aria-hidden />
        {isFavorite ? "お気に入り" : "お気に入りに追加"}
      </button>
    </form>
  );
}
