/**
 * 検索結果を LINE の Flex Message（カルーセル）に変換する。
 *
 * - 通常の推薦（最大5件）の後ろに、広告がある場合のみ「広告」と明記したカードを1枚追加
 * - リンクはすべて計測用リダイレクト（/api/r）を経由する。リダイレクト先はサーバー側で店舗データから決める
 * - 不明な情報は「不明」と表示し、作り上げない
 */
import { areaLabel, genreLabel } from "@/lib/shared/dictionaries";
import type { RecommendedStore, SearchOutcome, SponsoredSlot, Store } from "@/lib/shared/types";

type FlexComponent = Record<string, unknown>;
export type LineMessage = Record<string, unknown>;

const NAVY = "#1e3a8a";
const MUTED = "#64748b";

function trackUrl(baseUrl: string, kind: "detail" | "map" | "reservation", searchId: string, storeId: string, position: number) {
  const q = new URLSearchParams({ t: kind, s: searchId, store: storeId, pos: String(position) });
  return `${baseUrl}/api/r?${q.toString()}`;
}

function text(t: string, opts: FlexComponent = {}): FlexComponent {
  return { type: "text", text: t, wrap: true, size: "sm", color: "#111827", ...opts };
}

function storeBody(store: Store, budgetText: string, reasons: string[], header: FlexComponent | null): FlexComponent[] {
  return [
    ...(header ? [header] : []),
    text(store.name, { weight: "bold", size: "md" }),
    text(`${areaLabel(store.areaId)}｜${store.genreIds.map(genreLabel).join("・")}`, { color: MUTED, size: "xs" }),
    text(`予算：${budgetText}`, { size: "xs" }),
    text(`営業時間：${store.hours ?? "不明"}`, { size: "xs", color: MUTED }),
    ...(reasons.length ? [text(`おすすめ理由：${reasons.slice(0, 3).join("／")}`, { size: "xs", color: NAVY })] : []),
  ];
}

function footer(baseUrl: string, searchId: string, store: Store, position: number): FlexComponent {
  const buttons: FlexComponent[] = [
    { type: "button", style: "primary", color: NAVY, height: "sm", action: { type: "uri", label: "詳細を見る", uri: trackUrl(baseUrl, "detail", searchId, store.id, position) } },
    { type: "button", style: "secondary", height: "sm", action: { type: "uri", label: "地図", uri: trackUrl(baseUrl, "map", searchId, store.id, position) } },
  ];
  if (store.reservationUrl) {
    buttons.push({ type: "button", style: "link", height: "sm", action: { type: "uri", label: "予約ページ", uri: trackUrl(baseUrl, "reservation", searchId, store.id, position) } });
  }
  return { type: "box", layout: "vertical", spacing: "sm", contents: buttons };
}

function organicBubble(baseUrl: string, searchId: string, r: RecommendedStore): FlexComponent {
  return {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: storeBody(r.store, r.budgetText, r.reasons.filter((x) => x.points > 0).map((x) => x.label), text(`おすすめ ${r.rank}`, { size: "xxs", color: MUTED })),
    },
    footer: footer(baseUrl, searchId, r.store, r.rank),
  };
}

function sponsoredBubble(baseUrl: string, slot: SponsoredSlot): FlexComponent {
  const adUrl = `${baseUrl}/api/r/ad?${new URLSearchParams({ imp: slot.impressionId }).toString()}`;
  return {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      backgroundColor: "#f8fafc",
      contents: storeBody(slot.store, slot.budgetText, slot.matchReasons, text("広告（スポンサー）", { size: "xs", weight: "bold", color: "#b45309" })),
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "button", style: "secondary", height: "sm", action: { type: "uri", label: "詳細を見る（広告）", uri: adUrl } }],
    },
  };
}

export function buildSearchReply(outcome: SearchOutcome, baseUrl: string): LineMessage[] {
  if (outcome.results.length === 0) {
    const lines = ["条件に合うお店が見つかりませんでした。", ...outcome.parse.notes, ...outcome.suggestions];
    return [{ type: "text", text: lines.join("\n").slice(0, 1000) }];
  }

  const bubbles = outcome.results.map((r) => organicBubble(baseUrl, outcome.searchId, r));
  if (outcome.sponsored) bubbles.push(sponsoredBubble(baseUrl, outcome.sponsored));

  const intro = [
    `${outcome.results.length}件のお店が見つかりました。`,
    ...outcome.parse.notes,
    ...(outcome.results.length < 5 ? outcome.suggestions : []),
  ].join("\n");

  return [
    { type: "text", text: intro.slice(0, 1000) },
    {
      type: "flex",
      altText: `おすすめのお店 ${outcome.results.length}件`.slice(0, 400),
      contents: { type: "carousel", contents: bubbles },
    },
  ];
}

export const LINE_HELP_MESSAGE: LineMessage = {
  type: "text",
  text: "なまらAIです。食べたいもの・エリア・予算を自由に送ってください。\n例：「すすきの 焼肉 予算8000円」「札幌駅でランチ 1500円以内」",
};

export const LINE_RATE_LIMIT_MESSAGE: LineMessage = {
  type: "text",
  text: "短時間にたくさんの検索がありました。少し時間をおいてからもう一度お試しください。",
};
