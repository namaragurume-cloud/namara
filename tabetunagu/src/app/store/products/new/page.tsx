import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { ProductForm, type ProductFormDefaults } from "@/components/store/ProductForm";
import { ymd } from "@/lib/format";
import { suggestPrice } from "@/lib/price-suggest";
import { duplicateDefaults } from "@/lib/store-dashboard";
import { roundedTimeFromNow } from "@/lib/time";
import { requireStoreMember } from "@/server/auth/viewer";
import { getStoreDashboard, getStoreProduct, getTemplate, recentSalesHistory } from "@/server/services/store";
import { uploadsAvailable } from "@/server/services/uploads";

export const metadata: Metadata = { title: "出品する" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ from?: string; template?: string }> }) {
  const { from, template } = await searchParams;
  const { viewer, store } = await requireStoreMember("/store/products/new");
  const now = new Date();
  const today = ymd(now);
  const tomorrow = ymd(new Date(now.getTime() + 86_400_000));
  const dashboard = await getStoreDashboard(viewer.id, store.storeId, now);

  // 夕方の受取を基本に。すでに夕方以降なら「今から2時間」
  const nowStart = roundedTimeFromNow(15, now);
  const evening = nowStart < "17:30";
  let defaults: ProductFormDefaults = {
    name: "本日の食べつなぎBOX",
    description: "",
    category: dashboard.store.category,
    isBox: true,
    originalPrice: "",
    rescuePrice: "",
    quantity: 5,
    pickupDate: today,
    pickupStart: evening ? "18:00" : nowStart,
    pickupEnd: evening ? "20:00" : roundedTimeFromNow(135, now),
    imageUrl: "",
    templateId: "",
  };
  let source: string | null = null;
  let duplicated = false;

  if (template) {
    const t = await getTemplate(viewer.id, store.storeId, template);
    if (t) {
      defaults = { ...defaults, ...t, pickupStart: t.pickupStart, pickupEnd: t.pickupEnd, imageUrl: t.imageUrl ?? "", templateId: t.id };
      source = `いつもの「${t.name}」`;
    }
  } else if (from) {
    const p = await getStoreProduct(viewer.id, store.storeId, from);
    if (p) {
      // 複製: 商品名・画像・価格・参考価格・説明・BOX は引き継ぎ、数量と受取時間は必ず入力し直す（過去の在庫・日時を公開しない）
      defaults = { ...defaults, ...duplicateDefaults(p) };
      source = "複製元の商品";
      duplicated = true;
    }
  }

  let priceSuggestion = null;
  if (dashboard.store.plan === "standard" && defaults.originalPrice && defaults.rescuePrice) {
    const history = await recentSalesHistory(viewer.id, store.storeId, defaults.category, defaults.isBox);
    priceSuggestion = suggestPrice({ originalPrice: Number(defaults.originalPrice), currentPrice: Number(defaults.rescuePrice), history });
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="出品する"
        sub={
          duplicated
            ? "複製元の商品名・写真・価格・説明を入れました。数量と受取時間を入力して公開してください。"
            : source
              ? `${source}の内容を入れました。受取時間と数量を確認して公開してください。`
              : "商品名・価格・数量・受取時間を入れるだけで公開できます。"
        }
      />
      {!dashboard.lastProduct && !source && (
        // 初めての出品だけ、入力の例を短く出す
        <section className="mb-4 rounded-2xl border border-forest/25 bg-leaf-soft px-4 py-3 text-[13px] text-forest-2" data-testid="first-product-guide">
          <p className="font-bold">最初の商品を出品してみましょう。入力の例：</p>
          <dl className="tnum mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt>商品名</dt>
            <dd>本日のパン 食べつなぎBOX</dd>
            <dt>通常価格（相当）</dt>
            <dd>1,500円</dd>
            <dt>販売価格</dt>
            <dd>750円</dd>
            <dt>数量</dt>
            <dd>3</dd>
            <dt>受取</dt>
            <dd>20:00〜22:00</dd>
          </dl>
        </section>
      )}
      <div className="card p-5 md:p-6">
        <ProductForm
          storeId={store.storeId}
          defaults={defaults}
          today={today}
          tomorrow={tomorrow}
          priceSuggestion={priceSuggestion}
          plan={dashboard.store.plan}
          uploadsAvailable={uploadsAvailable()}
        />
      </div>
    </div>
  );
}
