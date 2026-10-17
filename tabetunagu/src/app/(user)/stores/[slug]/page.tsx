import { Clock, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FavoriteButton } from "@/components/forms/FavoriteButton";
import { ProductRow } from "@/components/product/ProductCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, SectionTitle } from "@/components/ui/Section";
import { areaLabel, categoryLabel } from "@/lib/categories";
import { getViewer } from "@/server/auth/viewer";
import { getStorePage } from "@/server/services/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStorePage(null, slug);
  return data ? { title: data.store.name, description: data.store.description } : {};
}

export default async function StorePage({ params }: Props) {
  const { slug } = await params;
  const viewer = await getViewer();
  const data = await getStorePage(viewer?.id ?? null, slug);
  if (!data) notFound();
  const { store, products, isFavorite } = data;
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex gap-1.5">
          <Badge tone="sand">{categoryLabel(store.category)}</Badge>
          <Badge tone="outline">{areaLabel(store.areaId)}</Badge>
        </div>
        <h1 className="text-[22px] font-bold">{store.name}</h1>
        {store.description && <p className="text-[13.5px] leading-relaxed text-ink-2">{store.description}</p>}
        <dl className="space-y-1.5 text-[13px] text-ink-2">
          {store.address && (
            <div className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
              <dd>{store.address}</dd>
            </div>
          )}
          {store.openingHours && (
            <div className="flex gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
              <dd>{store.openingHours}</dd>
            </div>
          )}
        </dl>
        <FavoriteButton storeId={store.id} isFavorite={isFavorite} next={`/stores/${store.slug}`} />
      </section>
      <section>
        <SectionTitle title="今日の食べつなぎ" />
        {products.length === 0 ? (
          <EmptyState title="今日の出品はまだありません" body="お気に入りに追加しておくと、出品のある日にまとめてお知らせします。" />
        ) : (
          <div className="space-y-2.5">
            {products.map((p) => (
              <ProductRow key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
