import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { ProductForm, type ProductFormDefaults } from "@/components/store/ProductForm";
import { ymd, hhmm } from "@/lib/format";
import { suggestPrice } from "@/lib/price-suggest";
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

  if (template) {
    const t = await getTemplate(viewer.id, store.storeId, template);
    if (t) {
      defaults = { ...defaults, ...t, pickupStart: t.pickupStart, pickupEnd: t.pickupEnd, imageUrl: t.imageUrl ?? "", templateId: t.id };
      source = `いつもの「${t.name}」`;
    }
  } else if (from) {
    const p = await getStoreProduct(viewer.id, store.storeId, from);
    if (p) {
      defaults = {
        ...defaults,
        name: p.name,
        description: p.description,
        category: p.category,
        isBox: p.isBox,
        originalPrice: p.originalPrice,
        rescuePrice: p.rescuePrice,
        quantity: p.quantity,
        pickupStart: hhmm(p.pickupStartAt),
        pickupEnd: hhmm(p.pickupEndAt),
        imageUrl: p.imageUrl ?? "",
        templateId: p.templateId ?? "",
      };
      source = "前回の出品";
    }
  }

  let priceSuggestion = null;
  if (dashboard.store.plan === "standard" && defaults.originalPrice && defaults.rescuePrice) {
    const history = await recentSalesHistory(viewer.id, store.storeId, defaults.category, defaults.isBox);
    priceSuggestion = suggestPrice({ originalPrice: Number(defaults.originalPrice), currentPrice: Number(defaults.rescuePrice), history });
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="出品する" sub={source ? `${source}の内容を入れました。受取時間と数量を確認して公開してください。` : "商品名・数量・価格・受取時間を入れるだけで公開できます。"} />
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
