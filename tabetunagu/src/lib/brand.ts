/** サービス内の言葉はここに集約する（使わない言葉は src/lib/ai-copy.ts の FORBIDDEN_WORDS） */
export const brand = {
  name: "TABETUNAGU",
  nameJa: "食べつなぐ",
  copy: "捨てられるはずだった、おいしさを。\n次の人へ。",
  philosophy: "食のバトンをつなぐ。",
  tagline: "今日のおいしさを、次の人へ。",
  description:
    "まだおいしく食べられるパン・お弁当・お惣菜・スイーツを、近くのお店から食べつなぎ価格で。予約して、お店で受け取るだけ。",
  /** v2（事前決済）がメインのときの説明 */
  descriptionV2:
    "まだおいしく食べられるパン・お弁当・お惣菜・スイーツを、近くのお店から食べつなぎ価格で。オンラインで注文して、お店で受け取るだけ。",
  priceLabel: "食べつなぎ価格",
  boxLabel: "食べつなぎBOX",
  cta: "食べつなぐ",
  completed: "食べつなぎ完了",
} as const;
