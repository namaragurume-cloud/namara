import { z } from "zod";

/** フォームの選択肢（フォーム表示とサーバー検証で共通） */
export const industryOptions = ["飲食店", "食品メーカー", "ホテル・宿泊施設", "その他"] as const;

export const budgetOptions = [
  "5万〜10万円未満",
  "10万〜20万円未満",
  "20万〜30万円未満",
  "30万円以上",
  "未定・相談して決めたい",
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
  company: required("会社名・店舗名"),
  name: required("ご担当者名", 50),
  email,
  industry: optionalEnum(industryOptions),
  product: optional(200),
  budget: optionalEnum(budgetOptions),
  timing: optional(100),
  creator: optional(200),
  message: required("お問い合わせ内容", 3000),
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
