export type FlowStep = { no: string; title: string; body: string };

export const flow: FlowStep[] = [
  {
    no: "01",
    title: "お問い合わせ",
    body: "お問い合わせフォーム、またはInstagram DMからお気軽にご相談ください。",
  },
  {
    no: "02",
    title: "ヒアリング",
    body: "PRの目的、ターゲット、ご予算、希望時期などをお伺いします。オンライン・対面のどちらにも対応します。",
  },
  {
    no: "03",
    title: "発信者・PR企画のご提案",
    body: "ご予算と目的に応じて、最適な発信者の組み合わせと企画をご提案します。",
  },
  {
    no: "04",
    title: "お見積もり・ご契約",
    body: "起用人数、投稿内容、実施時期、料金などを確定します。",
  },
  {
    no: "05",
    title: "PR実施・投稿管理",
    body: "発信者への連絡、投稿前の確認、投稿スケジュールの管理を行います。",
  },
  {
    no: "06",
    title: "効果レポート・ご報告",
    body: "投稿の成果を確認し、レポートを提出します。",
  },
];

export const flowNote = "PR実施までの期間は、案件の内容や発信者のスケジュールによって異なります。";
