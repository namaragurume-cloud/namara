import { z } from "zod";

/** フォームの選択肢（フォーム表示とサーバー検証で共通） */
export const industryOptions = ["飲食店", "食品メーカー", "ホテル・宿泊施設", "観光施設", "その他"] as const;

export const budgetOptions = ["3万〜10万円", "10万〜30万円", "30万円以上", "まだ決まっていない"] as const;

/** 料金ページなどから ?budget= で予算を引き継ぐためのキー */
export const budgetParams = {
  "3-10": "3万〜10万円",
  "10-30": "10万〜30万円",
  "30": "30万円以上",
} as const satisfies Record<string, (typeof budgetOptions)[number]>;
export type BudgetParam = keyof typeof budgetParams;

export const purposeOptions = [
  "集客を増やしたい",
  "新商品・新店舗をPRしたい",
  "認知度を高めたい",
  "まずは話を聞きたい",
] as const;

export const genreOptions = [
  "ラーメン",
  "カフェ・スイーツ",
  "焼肉・ジンギスカン",
  "居酒屋",
  "海鮮・寿司",
  "その他",
] as const;

const required = (label: string, max = 100) =>
  z
    .string({ error: `${label}を入力してください` })
    .trim()
    .min(1, `${label}を入力してください`)
    .max(max, `${label}は${max}文字以内で入力してください`);

const optional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `${max}文字以内で入力してください`)
    .optional()
    .default("");

const email = z
  .string({ error: "メールアドレスを入力してください" })
  .trim()
  .min(1, "メールアドレスを入力してください")
  .max(254, "メールアドレスが長すぎます")
  .pipe(z.email("メールアドレスの形式が正しくありません"));

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal("")]).optional().default("");

/** Bot 対策用の共通フィールド */
const antiSpam = {
  /** ハニーポット：人間には見えない入力欄。値が入っていたら Bot とみなす */
  website: z.string().max(500).optional().default(""),
  /** フォーム表示時刻（ミリ秒）。早すぎる送信を弾く */
  startedAt: z.coerce.number().optional(),
  turnstileToken: z.string().optional().default(""),
};

export const contactSchema = z.object({
  company: required("企業名・店舗名"),
  email,
  purpose: optionalEnum(purposeOptions),
  budget: optionalEnum(budgetOptions),
  message: optional(3000),
  // 以下は「詳しく入力する」を開いた場合のみ（任意）
  name: optional(50),
  industry: optionalEnum(industryOptions),
  product: optional(200),
  timing: optional(100),
  creator: optional(200),
  privacy: z.literal(true, { error: "個人情報の取扱いへの同意が必要です" }),
  ...antiSpam,
});

export type ContactInput = z.input<typeof contactSchema>;
export type ContactData = z.output<typeof contactSchema>;

export const partnerSchema = z.object({
  account: required("活動名・アカウント名"),
  email,
  snsUrl: z
    .string({ error: "InstagramまたはTikTokのURLを入力してください" })
    .trim()
    .min(1, "InstagramまたはTikTokのURLを入力してください")
    .max(300, "URLが長すぎます")
    .pipe(z.url({ protocol: /^https?$/, error: "URLの形式が正しくありません（https:// から入力）" })),
  followers: z.coerce
    .number({ error: "フォロワー数を数字で入力してください" })
    .int("フォロワー数は整数で入力してください")
    .min(1000, "登録条件はフォロワー1,000人以上です")
    .max(100_000_000, "フォロワー数をご確認ください"),
  area: required("活動エリア", 100),
  genres: z.array(z.enum(genreOptions)).min(1, "得意なグルメジャンルを1つ以上選択してください"),
  genreOther: optional(100),
  message: optional(1000),
  review: z.literal(true, { error: "登録内容の確認・審査への同意が必要です" }),
  privacy: z.literal(true, { error: "個人情報の取扱いへの同意が必要です" }),
  ...antiSpam,
});

export type PartnerInput = z.input<typeof partnerSchema>;
export type PartnerData = z.output<typeof partnerSchema>;

/** zod のエラーを { フィールド名: メッセージ } に変換 */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
