import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { areaLabel, featureLabel, genreLabel, sceneLabel } from "@/lib/shared/dictionaries";
import { formatBudget } from "@/lib/search/ranking";
import { getPublicStore } from "@/lib/server/services/store-service";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ad?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const store = getPublicStore(id);
  return { title: store ? store.name : "店舗が見つかりません" };
}

export default async function StoreDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { ad } = await searchParams;
  const store = getPublicStore(id);
  if (!store) notFound();
  const lunch = formatBudget(store, "lunch");
  const dinner = formatBudget(store, "dinner");
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${store.location.lat},${store.location.lng}`;

  return (
    <article className="pb-10">
      <Link href="/ai" className="text-xs text-muted underline">
        ← 検索に戻る
      </Link>
      <div className="mt-3 flex flex-wrap gap-2">
        {store.isSample && <Badge tone="ad">架空のサンプル店舗</Badge>}
        {ad === "1" && <Badge tone="ad">広告から表示</Badge>}
      </div>
      <h1 className="mt-2 text-xl font-bold text-ink">{store.name}</h1>
      <p className="text-sm text-muted">
        {areaLabel(store.areaId)}｜{store.genreIds.map(genreLabel).join("・")}
      </p>

      <dl className="mt-5 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-3 rounded-xl border border-line bg-paper p-4 text-sm">
        <dt className="text-muted">予算目安（昼）</dt>
        <dd>{store.budget.lunch ? lunch.text : "不明（ランチ営業の情報なし）"}</dd>
        <dt className="text-muted">予算目安（夜）</dt>
        <dd>{store.budget.dinner ? dinner.text : "不明"}</dd>
        <dt className="text-muted">価格の根拠</dt>
        <dd>{store.budget.basis ?? "価格情報を確認できていません"}</dd>
        <dt className="text-muted">営業時間</dt>
        <dd>{store.hours ?? "不明"}</dd>
        <dt className="text-muted">住所</dt>
        <dd>{store.address}</dd>
        <dt className="text-muted">特徴</dt>
        <dd className="flex flex-wrap gap-1">
          {store.features.length ? store.features.map((f) => <Badge key={f}>{featureLabel(f)}</Badge>) : "不明"}
        </dd>
        <dt className="text-muted">向いている場面</dt>
        <dd>{store.scenes.length ? store.scenes.map(sceneLabel).join("・") : "不明"}</dd>
        <dt className="text-muted">情報確認日</dt>
        <dd>{store.verification.verifiedAt ?? "未確認"}</dd>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm hover:border-blue">
          <MapPin className="size-4" aria-hidden />
          地図（エリアの概略位置）
        </a>
        {store.reservationUrl ? (
          <a href={store.reservationUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-navy px-3 py-2 text-sm font-bold text-white">
            予約ページ（デモ用リンク）
          </a>
        ) : (
          <span className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">予約リンク：不明</span>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">空席状況は確認していません。写真は利用許可と出典を確認できたものだけ掲載します（現在は未登録）。</p>
    </article>
  );
}
