/**
 * 業務ツールから自動送信するメッセージの文面。
 * 文章を変えたいときはここを編集してください（{…} は自動で差し込まれます）。
 */

const SIGN = "MIRATSUMU（なまらグルメ）";

export type Msg = { subject: string; text: string };

export const opsTemplates = {
  /** PR依頼（一括送信） */
  prRequest: (p: {
    creator: string;
    restaurant: string;
    title: string;
    offer: string;
    slots: string[];
    replyDeadline: string;
    url: string;
  }): Msg => ({
    subject: `【PRのご依頼】${p.restaurant}｜${p.title}`,
    text: [
      `${p.creator}さん`,
      "",
      "いつもありがとうございます！",
      `${p.restaurant}さんのPRのご依頼です。`,
      "",
      `■ 案件：${p.title}`,
      ...(p.offer ? [`■ 報酬・特典：${p.offer}`] : []),
      "■ 撮影候補日",
      ...p.slots.map((s) => `・${s}`),
      "",
      `下のページから、参加の可否と参加できる日時を${p.replyDeadline}までに選んでください（1分で終わります）。`,
      p.url,
      "",
      SIGN,
    ].join("\n"),
  }),

  /** 回答期限の前日リマインド */
  replyReminder: (p: { creator: string; restaurant: string; replyDeadline: string; url: string }): Msg => ({
    subject: `【リマインド】${p.restaurant}のPRのご回答`,
    text: [
      `${p.creator}さん`,
      "",
      `${p.restaurant}さんのPRのご回答期限が${p.replyDeadline}です。`,
      "参加できない場合も「今回は見送る」を選んでいただけると助かります🙏",
      p.url,
      "",
      SIGN,
    ].join("\n"),
  }),

  /** 撮影日の確定連絡 */
  confirmed: (p: {
    creator: string;
    restaurant: string;
    address?: string;
    slot: string;
    postDate: string;
    conditions: string;
    url: string;
  }): Msg => ({
    subject: `【撮影日確定】${p.restaurant}｜${p.slot}`,
    text: [
      `${p.creator}さん`,
      "",
      "撮影日が確定しました！",
      `■ 店舗：${p.restaurant}`,
      ...(p.address ? [`■ 住所：${p.address}`] : []),
      `■ 撮影日時：${p.slot}`,
      `■ 投稿予定日：${p.postDate}`,
      ...(p.conditions ? ["■ 投稿条件", p.conditions] : []),
      "",
      "詳細はこちら",
      p.url,
      "",
      SIGN,
    ].join("\n"),
  }),

  /** 撮影前日のリマインド */
  shootReminder: (p: { creator: string; restaurant: string; slot: string; url: string }): Msg => ({
    subject: `【明日の撮影】${p.restaurant}`,
    text: [
      `${p.creator}さん`,
      "",
      `明日は${p.restaurant}さんの撮影です。`,
      `■ 日時：${p.slot}`,
      "よろしくお願いします！",
      p.url,
      "",
      SIGN,
    ].join("\n"),
  }),

  /** 月末のインサイト提出のお願い */
  insightRequest: (p: { creator: string; posts: string[]; guide: string[]; url: string; viaLine: boolean }): Msg => ({
    subject: "【インサイト提出のお願い】今月のPR投稿",
    text: [
      `${p.creator}さん`,
      "",
      "今月もPR投稿ありがとうございました！",
      "以下の投稿のインサイト画面のスクリーンショットを送ってください。",
      ...p.posts.map((s) => `・${s}`),
      "",
      "■ 撮ってほしい画面",
      ...p.guide,
      "",
      p.viaLine ? "このトークに画像を送るだけでOKです（数字は自動で読み取ります）。ページからも送れます。" : "こちらのページから画像を送ってください（数字は自動で読み取ります）。",
      p.url,
      "",
      SIGN,
    ].join("\n"),
  }),

  /** インサイト未提出・不足のリマインド */
  insightReminder: (p: { creator: string; lines: string[]; url: string }): Msg => ({
    subject: "【リマインド】インサイトのご提出",
    text: [
      `${p.creator}さん`,
      "",
      "インサイトのスクリーンショットがまだそろっていない投稿があります。お手すきの際にお願いします🙏",
      ...p.lines,
      "",
      p.url,
      "",
      SIGN,
    ].join("\n"),
  }),

  /** スクショに必要な項目が写っていなかったとき */
  insightMissing: (p: { creator: string; post: string; missing: string[]; url: string; viaLine: boolean }): Msg => ({
    subject: "【インサイト】足りない項目があります",
    text: [
      `${p.creator}さん`,
      "",
      `スクリーンショットありがとうございます！${p.post}の投稿で、次の項目が画像に写っていませんでした。`,
      ...p.missing.map((m) => `・${m}`),
      "",
      `この項目が写っている画面のスクショを追加で${p.viaLine ? "このトークに" : "下のページから"}送ってください。`,
      p.url,
      "",
      SIGN,
    ].join("\n"),
  }),

  /** スクショがそろったとき */
  insightComplete: (p: { creator: string; post: string }): Msg => ({
    subject: "【インサイト】受け取りました",
    text: [`${p.creator}さん`, "", `${p.post}の投稿のインサイトを受け取りました。ありがとうございました！`, "", SIGN].join("\n"),
  }),

  /** LINEで画像を受け取ったが、どの投稿か決められないとき */
  insightWhichPost: (p: { creator: string; url: string }): Msg => ({
    subject: "【インサイト】投稿ごとに送ってください",
    text: [
      `${p.creator}さん`,
      "",
      "画像ありがとうございます！インサイトをお願いしている投稿が複数あるため、どの投稿の画像か自動で判断できませんでした。",
      "お手数ですが、下のページから投稿ごとに画像を送ってください。",
      p.url,
      "",
      SIGN,
    ].join("\n"),
  }),

  /** 飲食店へ：撮影日・投稿日の共有 */
  restaurantSchedule: (p: { restaurant: string; contact?: string; title: string; lines: string[]; url: string }): Msg => ({
    subject: `【撮影日のご案内】${p.title}`,
    text: [
      `${p.restaurant}${p.contact ? `\n${p.contact}様` : " ご担当者様"}`,
      "",
      "いつもお世話になっております。MIRATSUMUです。",
      "PRの撮影日・投稿予定日が決まりましたのでご案内いたします。",
      "",
      ...p.lines,
      "",
      "最新のスケジュールは下記ページでもご確認いただけます。",
      p.url,
      "",
      "当日はどうぞよろしくお願いいたします。",
      SIGN,
    ].join("\n"),
  }),

  /** 飲食店へ：レポート送付 */
  restaurantReport: (p: { restaurant: string; contact?: string; title: string; summary: string[]; url: string }): Msg => ({
    subject: `【PR結果レポート】${p.title}`,
    text: [
      `${p.restaurant}${p.contact ? `\n${p.contact}様` : " ご担当者様"}`,
      "",
      "いつもお世話になっております。MIRATSUMUです。",
      "先日のPR投稿の結果レポートをお送りいたします。",
      "",
      ...p.summary,
      "",
      "投稿ごとの詳細はこちらのレポートをご覧ください（PDFで保存もできます）。",
      p.url,
      "",
      "引き続きどうぞよろしくお願いいたします。",
      SIGN,
    ].join("\n"),
  }),

  /** 発信者を登録したときに1回だけ送る案内（DMなどで手動送信） */
  creatorOnboarding: (p: { creator: string; code: string; lineUrl?: string; portalUrl: string }): Msg => ({
    subject: "【MIRATSUMU】PRのご依頼の受け取り方法",
    text: [
      `${p.creator}さん`,
      "",
      "今後のPRのご依頼・撮影日のご案内・インサイト提出のお願いは、MIRATSUMUの公式LINEからお送りします。",
      "",
      "① 公式LINEを友だち追加して、下の連携コードを送ってください",
      `連携コード：${p.code}`,
      ...(p.lineUrl ? [`（こちらを押すとコードが入力された状態でトークが開きます）`, p.lineUrl] : []),
      "",
      "② あなた専用のページ（ご依頼の一覧・回答・インサイト入力）",
      p.portalUrl,
      "",
      "よろしくお願いします！",
      SIGN,
    ].join("\n"),
  }),

  lineWelcome:
    "友だち追加ありがとうございます！MIRATSUMU（なまらグルメ）です。\nPRのご依頼をこのLINEでお届けするため、担当から届いた「連携コード」をこのトークに送ってください。",
  lineLinked: (creator: string) =>
    `${creator}さん、連携が完了しました！\n今後のPRのご依頼・撮影日のご案内・インサイト提出のお願いはこのLINEに届きます。`,
  lineUnknown:
    "メッセージありがとうございます。担当者が確認してご連絡いたします。\n（連携コードの場合は、英数字6文字をそのまま送ってください）",
};
