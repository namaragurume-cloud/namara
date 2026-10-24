import { discountOf } from "./deals";
import { pickupLabel } from "./format";

/**
 * 「今日の食べつなぎ」（注目商品）の LINE メッセージ。LINE 公式アカウントの Messaging API（Push）で送る販促のお知らせ。
 * LINE ミニアプリのサービスメッセージ（操作への確認・応答専用）では送らない。
 *
 * 将来の日次配信（今回は無効）: 1日1回、1〜3件。対象は通知を受け取ると選んだ（オプトインした）ユーザーだけ。
 * 将来の選び方の候補: 割引率・残り数量・受取終了までの時間・STANDARD 店舗・新着・エリア・お気に入り・好み（今回は管理者が1件選ぶ）。
 */

export type FeaturedProduct = {
  id: string;
  name: string;
  storeName: string;
  imageUrl: string | null;
  originalPrice: number;
  rescuePrice: number;
  remaining: number;
  isBox: boolean;
  pickupStartAt: string;
  pickupEndAt: string;
};

/** 将来の配信の時間帯（今回はどれも有効にしない） */
export const FEATURED_SLOTS = [
  { id: "noon", time: "11:00", title: "今日の食べつなぎ" },
  { id: "evening", time: "18:00", title: "今夜の食べつなぎ" },
] as const;

/** 将来の通知の種類（ユーザーが受け取るものを選ぶ。無断で全員には送らない） */
export const MARKETING_TOPICS = ["featured_today", "nearby", "favorite_store"] as const;

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

/**
 * 商品詳細へのリンク。LIFF があれば LINE ミニアプリの URL（https://miniapp.line.me/<LIFF ID>/<パス>）。
 * 旧形式の liff.line.me・line://app/... は使わない。
 */
export function productDeepLink(productId: string, opts: { liffId: string; appUrl: string }) {
  const path = `/products/${encodeURIComponent(productId)}`;
  if (opts.liffId) return `https://miniapp.line.me/${opts.liffId}${path}`;
  return `${opts.appUrl.replace(/\/$/, "")}${path}`;
}

/** Flex Message の画像に使える URL（https の JPEG / PNG だけ。WebP などは画像なしのカードにする） */
export function flexImageUrl(imageUrl: string | null, appUrl: string): string | null {
  if (!imageUrl) return null;
  let url: URL;
  try {
    url = new URL(imageUrl, appUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !/\.(jpe?g|png)$/i.test(url.pathname) || url.toString().length > 2000) return null;
  return url.toString();
}

export type FeaturedCard = {
  title: string;
  storeName: string;
  productName: string;
  priceLine: string;
  discount: string | null;
  remaining: string;
  pickup: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string | null;
  altText: string;
};

/** カードの表示内容（プレビューと Flex Message の両方に使う） */
export function featuredCard(p: FeaturedProduct, opts: { liffId: string; appUrl: string; now: Date; title?: string }): FeaturedCard {
  const d = discountOf(p.originalPrice, p.rescuePrice);
  const title = opts.title ?? "今日の食べつなぎ";
  return {
    title,
    storeName: p.storeName,
    productName: p.name,
    priceLine: d ? `${yen(p.originalPrice)}相当 → ${yen(p.rescuePrice)}` : yen(p.rescuePrice),
    discount: d ? `${d.rate}%OFF` : null,
    remaining: `残り${p.remaining}${p.isBox ? "BOX" : "点"}`,
    pickup: pickupLabel(p.pickupStartAt, p.pickupEndAt, opts.now),
    ctaLabel: "商品を見る",
    ctaUrl: productDeepLink(p.id, opts),
    imageUrl: flexImageUrl(p.imageUrl, opts.appUrl),
    altText: `${title}：${p.storeName}「${p.name}」${yen(p.rescuePrice)}`.slice(0, 400),
  };
}

/** 1商品の Flex Message（bubble）。スマホで読みやすい最小限の構成 */
export function featuredFlexMessage(c: FeaturedCard) {
  return { type: "flex", altText: c.altText, contents: featuredFlexBubble(c) };
}

/** 1商品の bubble（日次通知のカルーセルでも使う） */
export function featuredFlexBubble(c: FeaturedCard) {
  const text = (t: string, extra: Record<string, unknown> = {}) => ({ type: "text", text: t, wrap: true, ...extra });
  return {
    type: "bubble",
    size: "kilo",
    ...(c.imageUrl ? { hero: { type: "image", url: c.imageUrl, size: "full", aspectRatio: "20:13", aspectMode: "cover" } } : {}),
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        text(c.title, { size: "xs", color: "#2f6b4f", weight: "bold" }),
        text(c.storeName, { size: "sm", color: "#555555" }),
        text(c.productName, { size: "lg", weight: "bold" }),
        {
          type: "box",
          layout: "baseline",
          spacing: "sm",
          contents: [
            text(c.priceLine, { size: "md", weight: "bold", flex: 0 }),
            ...(c.discount ? [text(c.discount, { size: "sm", color: "#2f6b4f", weight: "bold", flex: 0 })] : []),
          ],
        },
        text(`${c.remaining}・受取 ${c.pickup}`, { size: "sm", color: "#555555" }),
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "button", style: "primary", color: "#2f6b4f", action: { type: "uri", label: c.ctaLabel, uri: c.ctaUrl } }],
    },
  };
}
