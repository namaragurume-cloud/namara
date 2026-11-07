/**
 * 業務ツールから自動送信するメッセージの文面（初期値）。
 * 管理画面の「設定 → メッセージの文面」から編集でき、編集した内容が優先されます。
 *
 * {発信者名} のような { } の部分は、送るときに自動で差し込まれます。
 * 差し込む値が空（例：住所が未登録）のときは、その行ごと送られません。
 */

export type Msg = { subject: string; text: string };

export type TemplateDef = {
  /** 一覧に表示する名前 */
  title: string;
  /** いつ送られるか */
  when: string;
  /** 送り先 */
  to: "発信者" | "飲食店";
  /** メールで送るときの件名（LINEでは使わない） */
  subject?: string;
  body: string;
  /** 使える差し込み項目と、プレビュー用の例 */
  vars: Record<string, string>;
};

export const TEMPLATE_KEYS = [
  "prRequest",
  "replyReminder",
  "confirmed",
  "shootReminder",
  "insightRequest",
  "insightMissing",
  "insightComplete",
  "insightReminder",
  "insightWhichPost",
  "creatorOnboarding",
  "lineWelcome",
  "lineLinked",
  "lineUnknown",
  "restaurantSchedule",
  "restaurantReport",
  "signature",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

const SIGN_VAR = { 署名: "MIRATSUMU（なまらグルメ）" };

export const templateDefs: Record<TemplateKey, TemplateDef> = {
  prRequest: {
    title: "PR依頼",
    when: "案件ページで「一括送信」したとき",
    to: "発信者",
    subject: "【PRのご依頼】{店舗名}｜{案件名}",
    body: `{発信者名}さん

いつもありがとうございます！
{店舗名}さんのPRのご依頼です。

■ 案件：{案件名}
■ 報酬・特典：{報酬}
■ 撮影候補日
{撮影候補日}
■ 投稿日：{投稿日}（この中から選んでください）

下のページから、参加の可否・参加できる撮影日時・投稿日を{回答期限}までに選んでください（1分で終わります）。
{URL}

{署名}`,
    vars: {
      発信者名: "はなこ",
      店舗名: "焼肉 たいよう",
      案件名: "12月 新メニューPR",
      報酬: "飲食代無料＋謝礼 5,000円",
      撮影候補日: "・12/5(金) 18:00〜20:00\n・12/6(土) 18:00〜20:00",
      投稿日: "12/10(水)・12/12(金)",
      回答期限: "2026年12月1日(月)",
      URL: "https://…/m/…",
      ...SIGN_VAR,
    },
  },
  replyReminder: {
    title: "回答のリマインド",
    when: "回答期限の前日（未回答の人へ・自動）",
    to: "発信者",
    subject: "【リマインド】{店舗名}のPRのご回答",
    body: `{発信者名}さん

{店舗名}さんのPRのご回答期限が{回答期限}です。
参加できない場合も「今回は見送る」を選んでいただけると助かります🙏
{URL}

{署名}`,
    vars: { 発信者名: "はなこ", 店舗名: "焼肉 たいよう", 回答期限: "2026年12月1日(月)", URL: "https://…/m/…", ...SIGN_VAR },
  },
  confirmed: {
    title: "撮影日の確定連絡",
    when: "案件ページで「確定して発信者に連絡」したとき",
    to: "発信者",
    subject: "【撮影日確定】{店舗名}｜{撮影日時}",
    body: `{発信者名}さん

撮影日が確定しました！
■ 店舗：{店舗名}
■ 住所：{住所}
■ 撮影日時：{撮影日時}
■ 投稿日：{投稿日}
■ 投稿条件：{投稿条件}

詳細はこちら
{URL}

{署名}`,
    vars: {
      発信者名: "はなこ",
      店舗名: "焼肉 たいよう",
      住所: "札幌市中央区南5条西3丁目",
      撮影日時: "12/5(金) 18:00〜20:00",
      投稿日: "2026年12月10日(水)",
      投稿条件: "リール1本／店舗アカウントをタグ付け／#PR 表記",
      URL: "https://…/m/…",
      ...SIGN_VAR,
    },
  },
  shootReminder: {
    title: "撮影前日のリマインド",
    when: "撮影日の前日（自動）",
    to: "発信者",
    subject: "【明日の撮影】{店舗名}",
    body: `{発信者名}さん

明日は{店舗名}さんの撮影です。
■ 日時：{撮影日時}
よろしくお願いします！
{URL}

{署名}`,
    vars: { 発信者名: "はなこ", 店舗名: "焼肉 たいよう", 撮影日時: "12/5(金) 18:00〜20:00", URL: "https://…/m/…", ...SIGN_VAR },
  },
  insightRequest: {
    title: "インサイト提出のお願い",
    when: "毎月末（投稿日を過ぎた人へ・自動）／案件ページの「今すぐ提出をお願いする」",
    to: "発信者",
    subject: "【インサイト提出のお願い】今月のPR投稿",
    body: `{発信者名}さん

今月もPR投稿ありがとうございました！
以下の投稿のインサイト画面のスクリーンショットを送ってください。
{投稿一覧}

■ 撮ってほしい画面
{撮り方}

{送り方}
{URL}

{署名}`,
    vars: {
      発信者名: "はなこ",
      投稿一覧: "・焼肉 たいよう（撮影 12/5(金) 18:00〜20:00）",
      撮り方: "【Instagram】\n・投稿の「インサイトを見る」→「概要」…",
      送り方: "このトークに画像を送るだけでOKです（数字は自動で読み取ります）。ページからも送れます。",
      URL: "https://…/m/…",
      ...SIGN_VAR,
    },
  },
  insightMissing: {
    title: "スクショ不足の連絡",
    when: "送られたスクショに必要な項目が写っていなかったとき（自動）",
    to: "発信者",
    subject: "【インサイト】足りない項目があります",
    body: `{発信者名}さん

スクリーンショットありがとうございます！{店舗名}の投稿で、次の項目が画像に写っていませんでした。
{足りない項目}

この項目が写っている画面のスクショを追加で{送り先}送ってください。
{URL}

{署名}`,
    vars: { 発信者名: "はなこ", 店舗名: "焼肉 たいよう", 足りない項目: "・年齢\n・性別", 送り先: "このトークに", URL: "https://…/m/…", ...SIGN_VAR },
  },
  insightComplete: {
    title: "スクショ受け取りのお礼",
    when: "LINEで送られたスクショの項目がそろったとき（自動）",
    to: "発信者",
    subject: "【インサイト】受け取りました",
    body: `{発信者名}さん

{店舗名}の投稿のインサイトを受け取りました。ありがとうございました！

{署名}`,
    vars: { 発信者名: "はなこ", 店舗名: "焼肉 たいよう", ...SIGN_VAR },
  },
  insightReminder: {
    title: "インサイト未提出のリマインド",
    when: "提出のお願いから3日たってもそろっていないとき（自動）",
    to: "発信者",
    subject: "【リマインド】インサイトのご提出",
    body: `{発信者名}さん

インサイトのスクリーンショットがまだそろっていない投稿があります。お手すきの際にお願いします🙏
{投稿一覧}

{URL}

{署名}`,
    vars: { 発信者名: "はなこ", 投稿一覧: "・焼肉 たいよう：未提出", URL: "https://…/m/…", ...SIGN_VAR },
  },
  insightWhichPost: {
    title: "どの投稿の画像か分からないとき",
    when: "LINEで画像を受け取ったが、お願い中の投稿が複数あるとき（自動）",
    to: "発信者",
    body: `{発信者名}さん

画像ありがとうございます！インサイトをお願いしている投稿が複数あるため、どの投稿の画像か自動で判断できませんでした。
お手数ですが、下のページから投稿ごとに画像を送ってください。
{URL}

{署名}`,
    vars: { 発信者名: "はなこ", URL: "https://…/m/…", ...SIGN_VAR },
  },
  creatorOnboarding: {
    title: "最初の案内文",
    when: "発信者を登録したあと、DMでコピーして1回だけ送る",
    to: "発信者",
    subject: "【MIRATSUMU】PRのご依頼の受け取り方法",
    body: `{発信者名}さん

今後のPRのご依頼・撮影日のご案内・インサイト提出のお願いは、MIRATSUMUの公式LINEからお送りします。

① 公式LINEを友だち追加して、下の連携コードを送ってください
連携コード：{連携コード}
{連携リンク}

② あなた専用のページ（ご依頼の一覧・回答・インサイト入力）
{専用ページURL}

よろしくお願いします！
{署名}`,
    vars: {
      発信者名: "はなこ",
      連携コード: "ABC123",
      連携リンク: "（こちらを押すとコードが入力された状態でトークが開きます）\nhttps://line.me/R/oaMessage/…",
      専用ページURL: "https://…/m/…",
      ...SIGN_VAR,
    },
  },
  lineWelcome: {
    title: "友だち追加のあいさつ",
    when: "公式LINEが友だち追加されたとき（自動）",
    to: "発信者",
    body: `友だち追加ありがとうございます！MIRATSUMU（なまらグルメ）です。
PRのご依頼をこのLINEでお届けするため、担当から届いた「連携コード」をこのトークに送ってください。`,
    vars: {},
  },
  lineLinked: {
    title: "LINE連携の完了",
    when: "発信者が連携コードを送ったとき（自動）",
    to: "発信者",
    body: `{発信者名}さん、連携が完了しました！
今後のPRのご依頼・撮影日のご案内・インサイト提出のお願いはこのLINEに届きます。`,
    vars: { 発信者名: "はなこ" },
  },
  lineUnknown: {
    title: "連携コードが見つからないとき",
    when: "存在しない連携コードが送られたとき（自動）",
    to: "発信者",
    body: `メッセージありがとうございます。担当者が確認してご連絡いたします。
（連携コードの場合は、英数字6文字をそのまま送ってください）`,
    vars: {},
  },
  restaurantSchedule: {
    title: "飲食店への日程共有",
    when: "案件ページで飲食店へ日程を共有したとき",
    to: "飲食店",
    subject: "【撮影日のご案内】{案件名}",
    body: `{店舗名}
{宛名}

いつもお世話になっております。MIRATSUMUです。
PRの撮影日・投稿予定日が決まりましたのでご案内いたします。

{日程一覧}

最新のスケジュール（撮影・投稿の状況）は下記ページでいつでもご確認いただけます。
{URL}

当日はどうぞよろしくお願いいたします。
{署名}`,
    vars: {
      店舗名: "焼肉 たいよう",
      宛名: "山田様",
      案件名: "12月 新メニューPR",
      日程一覧: "■ 12/5(金) 18:00〜20:00　はなこ（@hanako）　投稿日：12/10(水)",
      URL: "https://…/p/…",
      ...SIGN_VAR,
    },
  },
  restaurantReport: {
    title: "飲食店へのレポート送付",
    when: "案件ページでレポートを送付したとき",
    to: "飲食店",
    subject: "【PR結果レポート】{案件名}",
    body: `{店舗名}
{宛名}

いつもお世話になっております。MIRATSUMUです。
先日のPR投稿の結果レポートをお送りいたします。

{結果の要約}

投稿ごとの詳細はこちらのレポートをご覧ください（PDFで保存もできます）。
{URL}

引き続きどうぞよろしくお願いいたします。
{署名}`,
    vars: {
      店舗名: "焼肉 たいよう",
      宛名: "山田様",
      案件名: "12月 新メニューPR",
      結果の要約: "■ 投稿数：3件\n■ 合計閲覧数・再生数：86,800回",
      URL: "https://…/p/…",
      ...SIGN_VAR,
    },
  },
  signature: {
    title: "署名",
    when: "各メッセージの {署名} に入ります",
    to: "発信者",
    body: "MIRATSUMU（なまらグルメ）",
    vars: {},
  },
};

const PLACEHOLDER = /\{([^{}\s]+)\}/g;

/** 文面の { } に値を差し込む。差し込む値がすべて空の行は丸ごと消す */
export function fillTemplate(text: string, vars: Record<string, string | undefined>): string {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const keys = [...line.matchAll(PLACEHOLDER)].map((m) => m[1]).filter((k) => k in vars);
    if (keys.length > 0 && keys.every((k) => !vars[k]?.trim())) continue;
    out.push(line.replace(PLACEHOLDER, (all, k: string) => (k in vars ? (vars[k] ?? "") : all)));
  }
  // 行を消したことで空行が続いたら1つにまとめる
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** 文面の中の、使えない { } の項目 */
export function unknownPlaceholders(text: string, key: TemplateKey): string[] {
  const allowed = new Set(Object.keys(templateDefs[key].vars));
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]).filter((k) => !allowed.has(k)))];
}
