import { contentPreview } from "./site";

/**
 * PR実績（事例）の一覧。企業名は匿名で掲載します。
 *
 * 【公開条件】以下がすべて確認できた事例のみ published: true にしてください。
 *   - 実績値と集計期間
 *   - クライアントからの公開許可（匿名掲載を含む）
 *   - PRとの関係（他の施策の有無）
 *   - 掲載する画像・動画の使用許可
 * 公開文章では、成果をPRだけの効果と断定する表現を使わないでください。
 */

export type CaseMetric = {
  label: string;
  before: string;
  after: string;
  /** 測定単位・比較期間（グラフや数値の注記に表示） */
  period: string;
  /** 強調表示する倍率など（任意） */
  highlight?: string;
};

export type CaseStudy = {
  slug: string;
  no: string;
  title: string;
  industry: string;
  summary: string;
  image?: string;
  metric: CaseMetric;
  challenge: string;
  actions: string[];
  media: string;
  result: string;
  insight: string;
  published: boolean;
  /** 公開前に確認が必要な事項（サイトには表示されません） */
  todo: string[];
};

export const cases: CaseStudy[] = [
  {
    slug: "restaurant-sales",
    no: "01",
    title: "飲食店の売上拡大",
    industry: "飲食店（業態未確認）",
    summary: "インフルエンサーPRを含む施策の実施期間に、売上が拡大した事例。",
    metric: {
      label: "売上",
      before: "200万円",
      after: "600万円",
      period: "【要確認】対象期間・比較方法",
      highlight: "3倍",
    },
    challenge: "【要確認】PR実施前の課題",
    actions: ["【要確認】実施した施策"],
    media: "【要確認】投稿媒体・起用した発信者の人数や規模",
    result:
      "PR実施期間を含む期間において、売上が200万円から600万円に推移しました。【要確認】期間と、PR以外の施策の有無",
    insight: "【要確認】実施後の考察",
    published: false,
    todo: ["対象期間", "業態", "施策内容", "PR以外の施策の有無", "匿名掲載の許可", "画像の掲載許可"],
  },
  {
    slug: "new-store-awareness",
    no: "02",
    title: "新店舗OPEN時の認知拡大",
    industry: "飲食店（新店舗）",
    summary: "新店舗のOPENにあわせてPRを実施した事例。",
    metric: {
      label: "Instagramフォロワー数",
      before: "0人",
      after: "2,000人",
      period: "【要確認】達成までの期間",
    },
    challenge: "新店舗OPEN時の認知獲得。【要確認】詳細",
    actions: ["新店舗OPEN時のインフルエンサーPR", "【要確認】その他の施策"],
    media: "【要確認】投稿媒体・起用した発信者の人数や規模",
    result: "店舗のInstagramアカウントのフォロワー数が0人から2,000人になりました。【要確認】期間",
    insight: "【要確認】実施後の考察",
    published: false,
    todo: ["達成までの期間", "その他の施策の有無", "匿名掲載の許可", "画像の掲載許可"],
  },
  {
    slug: "tabelog-access",
    no: "03",
    title: "食べログアクセスの増加",
    industry: "飲食店",
    summary: "PR実施後に食べログの店舗ページへのアクセスが増加した事例。",
    metric: {
      label: "食べログアクセス数",
      before: "PR実施前月",
      after: "【要確認】",
      period: "【要確認】「前月比200%」か「200%増」か定義を確認するまで数値化しない",
    },
    challenge: "【要確認】PR実施前の課題",
    actions: ["【要確認】実施した施策"],
    media: "【要確認】投稿媒体・起用した発信者の人数や規模",
    result: "【要確認】申告値は「PR実施前月と比較して200%UP」。定義の確認後に記載",
    insight: "【要確認】実施後の考察",
    published: false,
    todo: ["200%の定義（前月比200%／200%増）", "比較期間", "施策内容", "匿名掲載の許可"],
  },
];

export function getVisibleCases(): CaseStudy[] {
  return cases.filter((c) => c.published || contentPreview);
}

export function getCase(slug: string): CaseStudy | undefined {
  return getVisibleCases().find((c) => c.slug === slug);
}
