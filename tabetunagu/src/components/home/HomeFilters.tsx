import { ArrowRight, Cake, Croissant, Hotel, MapPin, Package, Salad, Soup } from "lucide-react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "../ui/cn";

/**
 * 「どこで受け取りますか？」エリアの選択（札幌 PoC）。選択中のエリアでホームの商品を絞り込む。
 * 将来現在地に対応するときは、areas の並び順と既定の選択を現在地から決める（UI はこのまま）。
 */
export function AreaPicker({
  areas,
  selected,
  total,
}: {
  areas: { id: string; label: string; count: number }[];
  selected: string | undefined;
  total: number;
}) {
  const options = [{ id: undefined, label: "すべて", count: total }, ...areas];
  return (
    <section aria-labelledby="area-title">
      <h2 id="area-title" className="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-ink">
        <MapPin className="h-4 w-4 text-forest" aria-hidden />
        どこで受け取りますか？
      </h2>
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="受け取るエリア" data-testid="area-picker">
        {options.map((a) => {
          const active = a.id === selected;
          return (
            <Link
              key={a.id ?? "all"}
              href={a.id ? `/?area=${a.id}` : "/"}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center rounded-2xl border px-1 py-2 text-center transition-colors",
                active ? "border-forest bg-forest text-white" : "border-line bg-paper text-ink hover:bg-canvas",
              )}
            >
              <span className="text-[12.5px] font-bold leading-tight">{a.label}</span>
              <span className={cn("tnum mt-0.5 text-[11px]", active ? "text-white/85" : "text-muted")}>{a.count}件</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

const CATEGORY_ICONS: Record<string, typeof Croissant> = {
  bread: Croissant,
  bento: Soup,
  deli: Salad,
  sweets: Cake,
  hotel: Hotel,
  other: Package,
};

/** カテゴリ（アイコン + 短いラベル）。横スクロール。タップで商品一覧（選択中のエリアを引き継ぐ） */
export function CategoryRail({ area }: { area: string | undefined }) {
  const href = (category?: string) => {
    const qs = new URLSearchParams();
    if (area) qs.set("area", area);
    if (category) qs.set("category", category);
    const s = qs.toString();
    return s ? `/products?${s}` : "/products";
  };
  return (
    <section aria-labelledby="category-title">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="category-title" className="text-[14px] font-bold text-ink">
          なにを食べつなぐ？
        </h2>
        <Link href={href()} className="flex min-h-[32px] items-center gap-1 text-[12px] font-semibold text-forest">
          すべて見る <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" data-testid="category-rail">
        {CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICONS[c.id] ?? Package;
          return (
            <li key={c.id} className="shrink-0">
              <Link href={href(c.id)} className="flex w-[64px] flex-col items-center gap-1.5 py-1">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sand text-forest">
                  <Icon className="h-[22px] w-[22px]" strokeWidth={1.6} aria-hidden />
                </span>
                <span className="text-[12px] font-semibold text-ink-2">{c.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
