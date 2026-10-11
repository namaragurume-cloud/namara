export type HistoryYear = {
  year: string;
  events: { month: string; text: string }[];
};

export const history: HistoryYear[] = [
  {
    year: "2021",
    events: [
      { month: "4月", text: "なまらグルメ運用開始" },
      { month: "8月", text: "Instagramフォロワー1万人達成" },
    ],
  },
  {
    year: "2022",
    events: [{ month: "2月", text: "初のコラボ商品開発" }],
  },
  {
    year: "2023",
    events: [
      { month: "5月", text: "初のプロデュース店舗OPEN" },
      { month: "7月", text: "ビールを販売しながらキッチンカーで北海道一周" },
      { month: "8月", text: "キッチンカーイベント開催" },
    ],
  },
  {
    year: "2024",
    events: [
      { month: "8月", text: "サッポロビールとのコラボ企画実施" },
      { month: "9月", text: "コラボ企画としてオータム出店" },
    ],
  },
  {
    year: "2025",
    events: [
      { month: "1月", text: "Instagramフォロワー10万人達成" },
      { month: "2月", text: "「サッポロ クラシック応援団員」就任" },
    ],
  },
  {
    year: "2026",
    events: [{ month: "4月", text: "自社運営店舗「三鳥目の夕日」OPEN" }],
  },
];
