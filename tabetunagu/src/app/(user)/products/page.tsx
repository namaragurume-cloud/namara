import type { Metadata } from "next";
import Link from "next/link";
import { ProductRow } from "@/components/product/ProductCard";
import { ChipLink, ChipRow } from "@/components/ui/Chip";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/Section";
import { AREAS, CATEGORIES } from "@/lib/categories";
import { getViewer } from "@/server/auth/viewer";
import { listAvailableProducts, type CatalogSort, type CatalogTime } from "@/server/services/catalog";

export const metadata: Metadata = { title: "さがす" };

const SORTS: { id: CatalogSort; label: string }[] = [
  { id: "recommended", label: "おすすめ" },
  { id: "nearby", label: "近い" },
  { id: "ending", label: "終了時間順" },
  { id: "price", label: "価格" },
];
const TIMES: { id: CatalogTime; label: string }[] = [
  { id: "now", label: "今すぐ受取" },
  { id: "before19", label: "19時までに受取開始" },
  { id: "after19", label: "19時以降も受取OK" },
];

type Params = { area?: string; category?: string; time?: string; sort?: string };

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const area = pick(sp.area, AREAS.map((a) => a.id));
  const category = pick(sp.category, CATEGORIES.map((c) => c.id));
  const time = pick(sp.time, TIMES.map((t) => t.id));
  const explicitSort = pick(sp.sort, SORTS.map((s) => s.id));
  const sort = explicitSort ?? (area ? "nearby" : "recommended");

  const href = (patch: Partial<Params>) => {
    const next = { area, category, time, sort: explicitSort, ...patch };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `/products?${s}` : "/products";
  };

  const viewer = await getViewer();
  const items = await listAvailableProducts(viewer?.id ?? null, { area, category, time, sort });

  return (
    <div className="space-y-4">
      <h1 className="text-[20px] font-bold">さがす</h1>

      <div className="space-y-2.5">
        <ChipRow>
          <ChipLink href={href({ area: undefined })} active={!area}>
            すべてのエリア
          </ChipLink>
          {AREAS.map((a) => (
            <ChipLink key={a.id} href={href({ area: a.id })} active={area === a.id}>
              {a.label}
            </ChipLink>
          ))}
        </ChipRow>
        <ChipRow>
          <ChipLink href={href({ category: undefined })} active={!category}>
            すべて
          </ChipLink>
          {CATEGORIES.map((c) => (
            <ChipLink key={c.id} href={href({ category: c.id })} active={category === c.id}>
              {c.label}
            </ChipLink>
          ))}
        </ChipRow>
        <ChipRow>
          {TIMES.map((t) => (
            <ChipLink key={t.id} href={href({ time: time === t.id ? undefined : t.id })} active={time === t.id}>
              {t.label}
            </ChipLink>
          ))}
        </ChipRow>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
        <p className="tnum shrink-0 text-[12px] text-muted">{items.length}件</p>
        <div className="no-scrollbar flex gap-1 overflow-x-auto" role="group" aria-label="並び替え">
          {SORTS.map((s) => (
            <Link
              key={s.id}
              href={href({ sort: s.id })}
              scroll={false}
              aria-current={sort === s.id ? "true" : undefined}
              className={cn("shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold", sort === s.id ? "bg-sand text-ink" : "text-muted")}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>
      {sort === "nearby" && !area && <p className="-mt-2 text-[11.5px] text-muted">エリアを選ぶと、近いエリアの順に並びます。</p>}

      {items.length === 0 ? (
        <EmptyState title="条件に合う商品はありません" body="エリアやカテゴリーを変えてみてください。" />
      ) : (
        <div className="space-y-2.5">
          {items.map((p, i) => (
            <ProductRow key={p.id} product={p} priority={i < 3} />
          ))}
        </div>
      )}
    </div>
  );
}
