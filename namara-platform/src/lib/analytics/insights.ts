/**
 * AI店長の改善提案（モック：ルールベース）。
 *
 * 今は外部AIを使わず、決まったルールで提案を作ります。
 * 将来 OpenAI で文章を生成する場合も、「根拠（evidence）」はここで計算した数値だけを渡し、
 * AI に数値を作らせないようにします。
 */
import { featureLabel, sceneLabel } from "@/lib/shared/dictionaries";
import type { Store } from "@/lib/shared/types";
import type { MonthComparison } from "./aggregate";

export type ActionSuggestion = {
  id: string;
  title: string;
  priority: "高" | "中" | "低";
  evidence: string[];
  owner: string;
  dueInDays: number;
};

export type InsightInput = {
  store: Store;
  featureTrend: MonthComparison[];
  sceneTrend: MonthComparison[];
  unrepliedReviews: number;
  lowRatingShare30d: number | null;
  detailRate: number | null;
  areaDetailRate: number | null;
};

const PRIORITY_ORDER = { 高: 0, 中: 1, 低: 2 } as const;

export function buildActionSuggestions(input: InsightInput): ActionSuggestion[] {
  const out: ActionSuggestion[] = [];
  const { store } = input;

  const rising = [...input.featureTrend.map((t) => ({ ...t, kind: "feature" as const })), ...input.sceneTrend.map((t) => ({ ...t, kind: "scene" as const }))]
    .filter((t) => t.changePct !== null && t.changePct >= 20 && (t.current ?? 0) >= 10)
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));

  for (const t of rising.slice(0, 2)) {
    const has = t.kind === "feature" ? store.features.includes(t.key as Store["features"][number]) : store.scenes.includes(t.key as Store["scenes"][number]);
    const label = t.kind === "feature" ? featureLabel(t.key) : sceneLabel(t.key);
    out.push({
      id: `trend-${t.key}`,
      title: has ? `「${label}」を打ち出した投稿・プランを用意する` : `「${label}」への対応可否を店舗情報に明記する`,
      priority: "高",
      evidence: [
        `エリア内の「${label}」を含む検索が前月同期間比 +${t.changePct}%（約${t.current}回）`,
        has ? `貴店は「${label}」に対応済みとして登録されています` : `貴店は「${label}」未対応として登録されています（対応できる場合は情報更新で表示対象になります）`,
        "※検索回数は来店数ではありません",
      ],
      owner: "店長",
      dueInDays: 7,
    });
  }

  if (input.unrepliedReviews >= 3) {
    out.push({
      id: "reply-reviews",
      title: `未返信の口コミ${input.unrepliedReviews}件に返信する`,
      priority: input.unrepliedReviews >= 10 ? "高" : "中",
      evidence: [`未返信の口コミが${input.unrepliedReviews}件あります（口コミデータはモック）`, "返信はAI返信案を参考に、必ず人が確認してから投稿します"],
      owner: "ホール責任者",
      dueInDays: 3,
    });
  }

  if (input.lowRatingShare30d !== null && input.lowRatingShare30d >= 0.15) {
    out.push({
      id: "low-rating",
      title: "低評価の口コミで多い指摘（待ち時間・接客）を朝礼で共有する",
      priority: "中",
      evidence: [`直近30日の★1〜2の割合：${Math.round(input.lowRatingShare30d * 100)}%（モック口コミ）`],
      owner: "店長",
      dueInDays: 7,
    });
  }

  if (input.detailRate !== null && input.areaDetailRate !== null && input.detailRate < input.areaDetailRate) {
    out.push({
      id: "detail-rate",
      title: "店舗写真とおすすめメニューの情報を追加する",
      priority: "中",
      evidence: [
        `検索表示からの詳細クリック率：${input.detailRate}%（同エリア平均 ${input.areaDetailRate}%）`,
        "写真は利用許可と出典表記があるものだけ掲載できます",
      ],
      owner: "広報担当",
      dueInDays: 14,
    });
  }

  if (out.length < 3) {
    out.push({
      id: "survey",
      title: "QRアンケート（NAMARA VOICE）で料理・接客の満足度を集める",
      priority: "低",
      evidence: ["改善の根拠になる来店客の声がまだ少ない状態です", "アンケートは評価に関係なく全員にお願いし、口コミ投稿を条件にした特典は付けません"],
      owner: "店長",
      dueInDays: 30,
    });
  }

  return out.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]).slice(0, 3);
}
