import { categoryLabel } from "./categories";

export type DescriptionInput = {
  name: string;
  isBox: boolean;
  category: string;
  rescuePrice: number;
  originalPrice?: number | null;
  quantity: number;
  pickupEnd: string; // HH:MM
  storeName?: string;
  keywords?: string;
};

/** サービスのトーンに合わない言葉。AI の出力に含まれていたらテンプレートに切り替える。 */
export const FORBIDDEN_WORDS = ["レスキュー", "救う", "救い", "救出", "半額", "激安", "投げ売り", "廃棄寸前", "在庫処分", "SDGs"];

export function containsForbiddenWord(text: string) {
  return FORBIDDEN_WORDS.some((w) => text.includes(w));
}

const CATEGORY_LINES: Record<string, { box: string; item: string }> = {
  bread: { box: "今日店頭に並んだパンを詰め合わせました。", item: "今日焼き上げたパンを、そのままのおいしさで。" },
  bento: { box: "今日つくったお弁当やおかずを詰め合わせました。", item: "今日つくったお弁当を、次の方へおつなぎします。" },
  deli: { box: "本日のお惣菜を、彩りよく詰め合わせました。", item: "本日仕込んだお惣菜を、晩ごはんのもう一品に。" },
  sweets: { box: "今日仕上げたケーキや焼き菓子を詰め合わせました。", item: "今日仕上げたスイーツを、少しお得に。" },
  hotel: { box: "ホテルの厨房で今日仕込んだ料理を詰め合わせました。", item: "ホテルの厨房で今日仕込んだ一品を、ご家庭でも。" },
  other: { box: "今日のおいしいものを詰め合わせました。", item: "今日のおいしさを、次の方へおつなぎします。" },
};

/**
 * テンプレートによる商品説明（OpenAI 未設定時・FREE プランの上限超過時・エラー時に使う）。
 * 煽らず、押し付けず、「おいしい」「お得」「次につなぐ」を自然に伝える。
 */
export function templateDescription(input: DescriptionInput): string {
  const lines = CATEGORY_LINES[input.category] ?? CATEGORY_LINES.other;
  const unit = input.isBox ? "BOX" : "点";
  const first = input.isBox ? "本日限定の食べつなぎBOX。" : `本日の${input.name.trim() || categoryLabel(input.category)}。`;
  const second = input.isBox ? lines.box : lines.item;
  const parts = [first, second];
  if (input.isBox) parts.push("中身は当日のお楽しみです。");
  if (input.keywords?.trim()) parts.push(`${input.keywords.trim().replace(/[。.]$/, "")}。`);
  if (input.isBox && input.originalPrice && input.originalPrice > input.rescuePrice) {
    parts.push(`${input.originalPrice.toLocaleString("ja-JP")}円相当の内容を、${input.rescuePrice.toLocaleString("ja-JP")}円でおつなぎします。`);
  }
  parts.push(`${input.pickupEnd}までのお受け取り限定、残り${input.quantity}${unit}です。`);
  return parts.join("\n");
}

/** AI 出力の後処理。空・長すぎ・トーン違反なら null を返す（呼び出し側でテンプレートに切り替える）。 */
/** AI に書かせない情報（アレルゲン・原材料・期限・安全性） */
export const SAFETY_INFO_RE = /アレルゲン|アレルギー|原材料|消費期限|賞味期限|安全|無添加|健康/;

export function sanitizeAiDescription(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^["「『\s]+|["」』\s]+$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length < 10 || cleaned.length > 400) return null;
  if (containsForbiddenWord(cleaned)) return null;
  // アレルゲン・原材料・期限・安全性は AI に推測させない（お店が確認して書く）。含まれていればテンプレートに切り替える
  if (SAFETY_INFO_RE.test(cleaned)) return null;
  return cleaned;
}
