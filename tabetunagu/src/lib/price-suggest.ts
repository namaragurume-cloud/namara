/**
 * AI値引き提案（MVP: 直近の販売履歴によるルールベース）。
 * 将来は product_sales_history（曜日・時間・天気など）を使った需要予測モデルに置き換える。
 */
export type PriceHistory = {
  rescuePrice: number;
  originalPrice: number;
  listed: number;
  reserved: number;
  minutesToSellOut: number | null;
};

export type PriceSuggestion = {
  suggestedPrice: number;
  direction: "up" | "down" | "keep";
  reason: string;
  sampleSize: number;
};

const roundTo10 = (n: number) => Math.round(n / 10) * 10;

export function suggestPrice(input: { originalPrice: number; currentPrice: number; history: PriceHistory[] }): PriceSuggestion | null {
  const { originalPrice, currentPrice, history } = input;
  if (history.length < 3 || originalPrice <= 0) return null;
  const listed = history.reduce((s, h) => s + h.listed, 0);
  const reserved = history.reduce((s, h) => s + h.reserved, 0);
  if (listed === 0) return null;
  const sellThrough = reserved / listed;
  const soldOut = history.filter((h) => h.minutesToSellOut != null);
  const fastSellOut =
    soldOut.length >= Math.ceil(history.length * 0.6) &&
    median(soldOut.map((h) => h.minutesToSellOut as number)) <= 90;

  // 下限: 通常価格の30%、上限: 通常価格の80%
  const min = roundTo10(originalPrice * 0.3);
  const max = roundTo10(originalPrice * 0.8);
  const clamp = (n: number) => Math.min(Math.max(roundTo10(n), min), Math.max(min, max));
  const pct = Math.round(sellThrough * 100);

  if (fastSellOut && sellThrough >= 0.95) {
    const price = clamp(currentPrice * 1.08);
    if (price > currentPrice) {
      return {
        suggestedPrice: price,
        direction: "up",
        reason: `直近${history.length}回はほぼ完売（販売率${pct}%）で、早い時間につながっています。少し価格を上げても食べつなげる見込みです。`,
        sampleSize: history.length,
      };
    }
  }
  if (sellThrough < 0.6) {
    const price = clamp(currentPrice * 0.9);
    if (price < currentPrice) {
      return {
        suggestedPrice: price,
        direction: "down",
        reason: `直近${history.length}回の販売率は${pct}%です。価格を少し下げるか、数量を控えめにすると食べつなぎやすくなります。`,
        sampleSize: history.length,
      };
    }
  }
  return {
    suggestedPrice: clamp(currentPrice),
    direction: "keep",
    reason: `直近${history.length}回の販売率は${pct}%です。今の価格がちょうど良さそうです。`,
    sampleSize: history.length,
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
