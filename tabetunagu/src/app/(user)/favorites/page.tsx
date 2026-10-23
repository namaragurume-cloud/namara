import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Section";
import { areaLabel } from "@/lib/categories";
import { requireViewer } from "@/server/auth/viewer";
import { listFavoriteStores } from "@/server/services/reservations";

export const metadata: Metadata = { title: "お気に入り" };

export default async function FavoritesPage() {
  const viewer = await requireViewer("/favorites");
  const favorites = await listFavoriteStores(viewer.id);
  return (
    <div className="space-y-4">
      <h1 className="text-[20px] font-bold">お気に入り</h1>
      {favorites.length === 0 ? (
        <EmptyState
          title="お気に入りの店舗はまだありません"
          body="店舗ページの「お気に入りに追加」から登録できます。"
          action={<ButtonLink href="/products">商品を探す</ButtonLink>}
        />
      ) : (
        <ul className="space-y-2">
          {favorites.map((s) => (
            <li key={s.id}>
              <Link href={`/stores/${s.slug}`} className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3">
                <span>
                  <span className="block text-[14px] font-bold">{s.name}</span>
                  <span className="block text-[12px] text-muted">{areaLabel(s.area_id)}</span>
                </span>
                {s.live > 0 ? <Badge tone="green">出品中 {s.live}件</Badge> : <Badge tone="outline">本日なし</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
