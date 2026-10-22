import { areaLabel, featureLabel, genreLabel, sceneLabel } from "@/lib/shared/dictionaries";
import type { SearchConditions } from "@/lib/shared/types";

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

/** 読み取った条件を「エリア：すすきの」のような表示用ラベルにする */
export function describeConditions(c: SearchConditions): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (c.areaIds.length) out.push({ label: "エリア", value: c.areaIds.map(areaLabel).join("・") });
  else if (c.cities.length) out.push({ label: "エリア", value: c.cities.join("・") });
  if (c.genreIds.length) out.push({ label: "ジャンル", value: c.genreIds.map(genreLabel).join("・") });
  if (c.budget) {
    const b = c.budget;
    const v =
      b.min !== null && b.max !== null ? `${yen(b.min)}〜${yen(b.max)}` : b.max !== null ? `${yen(b.max)}以内` : b.min !== null ? `${yen(b.min)}以上` : b.target !== null ? `${yen(b.target)}前後` : "";
    out.push({ label: "予算", value: `${v}（1人）` });
  }
  if (c.mealTime) out.push({ label: "時間帯", value: c.mealTime === "lunch" ? "ランチ" : "夜" });
  const scenes = c.scenes.filter((s) => s !== "lunch");
  if (scenes.length) out.push({ label: "シーン", value: scenes.map(sceneLabel).join("・") });
  if (c.features.length) out.push({ label: "希望", value: c.features.map(featureLabel).join("・") });
  if (c.partySize) out.push({ label: "人数", value: `${c.partySize}人` });
  if (c.dateText || c.timeText) out.push({ label: "日時", value: [c.dateText, c.timeText].filter(Boolean).join(" ") });
  if (c.keywords.length) out.push({ label: "その他", value: c.keywords.join("・") });
  return out;
}
