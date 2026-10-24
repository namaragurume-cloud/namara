import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { ProductVisual } from "@/components/product/ProductVisual";
import { QuickRelistForm } from "@/components/store/QuickRelistForm";
import { Notice } from "@/components/ui/Section";
import { monthDay, ymd } from "@/lib/format";
import { previousTimes, type RelistSource } from "@/lib/quick-relist";
import { requireStoreMember } from "@/server/auth/viewer";
import { getRelistSource, listRelistSources } from "@/server/services/quick-relist";

export const metadata: Metadata = { title: "かんたん出品" };

/**
 * かんたん出品: 過去に出品した商品を選び、数量と受取時間だけ入力してもう一度出品する（オーナー・スタッフ）。
 * 新しい商品を初めて登録するときは、詳細な「出品する」フォーム（/store/products/new）。
 */
export default async function QuickRelistPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const { viewer, store } = await requireStoreMember("/store/products/quick");
  const now = new Date();

  if (from) {
    const source = await getRelistSource(viewer.id, store.storeId, from);
    if (source) {
      const times = previousTimes(source);
      return (
        <div className="mx-auto max-w-md space-y-4" data-testid="quick-relist">
          <Link href="/store/products/quick" className="text-[13px] font-semibold text-forest">
            ← 商品を選び直す
          </Link>
          <h1 className="text-[20px] font-bold">かんたん出品</h1>
          <QuickRelistForm
            storeId={store.storeId}
            source={{
              id: source.id,
              name: source.name,
              imageUrl: source.imageUrl,
              category: source.category,
              isBox: source.isBox,
              rescuePrice: source.rescuePrice,
              originalPrice: source.originalPrice,
              previousQuantity: source.quantity,
              previousStart: times.start,
              previousEnd: times.end,
            }}
            today={ymd(now)}
            tomorrow={ymd(new Date(now.getTime() + 86_400_000))}
            nowIso={now.toISOString()}
          />
        </div>
      );
    }
  }

  const { recent, usual } = await listRelistSources(viewer.id, store.storeId, now);
  return (
    <div className="mx-auto max-w-md space-y-5" data-testid="quick-relist-list">
      <PageHeader title="かんたん出品" sub="過去の商品を選んで、数量と受取時間だけ入力すれば出品できます。" />
      {from && <Notice tone="error">商品が見つかりませんでした。下の一覧から選んでください。</Notice>}
      {recent.length === 0 ? (
        <div className="card p-5 text-center" data-testid="quick-relist-empty">
          <p className="text-[14px] font-semibold">まだ出品した商品がありません。</p>
          <Link href="/store/products/new" className="mt-3 inline-block text-[14px] font-semibold text-forest">
            最初の商品を出品する
          </Link>
        </div>
      ) : (
        <>
          {usual.length > 0 && <SourceList title="いつもの商品" items={usual} testId="quick-relist-usual" showTimes />}
          <SourceList title="最近の商品" items={recent} testId="quick-relist-recent" />
        </>
      )}
      <p className="text-center text-[12.5px] text-muted">
        新しい商品を初めて登録するときは
        <Link href="/store/products/new" className="ml-1 font-semibold text-forest">
          出品する（詳細）
        </Link>
      </p>
    </div>
  );
}

function SourceList({ title, items, testId, showTimes }: { title: string; items: RelistSource[]; testId: string; showTimes?: boolean }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-[13px] font-bold text-ink-2">{title}</h2>
      <ul className="card divide-y divide-line" data-testid={testId}>
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/store/products/quick?from=${p.id}`} className="flex min-h-[72px] items-center gap-3 px-3 py-2.5" data-testid="quick-relist-source">
              <ProductVisual imageUrl={p.imageUrl} category={p.category} alt="" sizes="56px" className="h-14 w-14 shrink-0 rounded-xl" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-bold">{p.name}</span>
                <span className="tnum block text-[12.5px] text-ink-2">
                  {p.rescuePrice.toLocaleString("ja-JP")}円・{p.originalPrice.toLocaleString("ja-JP")}円相当
                </span>
                <span className="tnum block text-[11.5px] text-muted">
                  前回 {monthDay(p.pickupStartAt)}
                  {showTimes && p.times > 0 && `・30日で${p.times}回`}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
