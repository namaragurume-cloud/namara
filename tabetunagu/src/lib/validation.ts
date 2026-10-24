import { z } from "zod";
import { CATEGORY_IDS } from "./categories";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const text = (label: string, max: number) =>
  z
    .string({ error: `${label}を入力してください` })
    .trim()
    .min(1, `${label}を入力してください`)
    .max(max, `${label}は${max}文字以内で入力してください`);

const optionalText = (max: number) => z.string().trim().max(max, `${max}文字以内で入力してください`).optional().default("");

const yenInt = (label: string) =>
  z.coerce
    .number({ error: `${label}を入力してください` })
    .int(`${label}は整数で入力してください`)
    .min(1, `${label}を入力してください`)
    .max(100_000, `${label}は100,000円以下にしてください`);

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal("false"), z.literal(""), z.boolean()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true" || v === "1");

export const productFormSchema = z
  .object({
    name: text("商品名", 60),
    description: optionalText(600),
    category: z.enum(CATEGORY_IDS, { error: "カテゴリーを選んでください" }),
    isBox: checkbox,
    originalPrice: yenInt("通常価格"),
    rescuePrice: yenInt("食べつなぎ価格"),
    quantity: z.coerce.number().int().min(1, "数量は1以上にしてください").max(999, "数量は999以下にしてください"),
    pickupDate: z.string().regex(YMD, "受取日を選んでください"),
    pickupStart: z.string().regex(HHMM, "受取開始時刻を入力してください"),
    pickupEnd: z.string().regex(HHMM, "受取終了時刻を入力してください"),
    imageUrl: z.string().trim().max(500).optional().default(""),
    templateId: z.string().uuid().optional().or(z.literal("")).default(""),
    saveTemplate: checkbox,
  })
  .refine((v) => v.rescuePrice <= v.originalPrice, {
    path: ["rescuePrice"],
    error: "食べつなぎ価格は通常価格以下にしてください",
  });

export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductForm = z.output<typeof productFormSchema>;

export const storeSettingsSchema = z.object({
  name: text("店舗名", 80),
  category: z.enum(CATEGORY_IDS),
  address: optionalText(200),
  phone: optionalText(30),
  description: optionalText(600),
  openingHours: optionalText(200),
  pickupNote: optionalText(300),
});

export const aiDescriptionSchema = z.object({
  name: text("商品名", 60),
  isBox: z.boolean(),
  category: z.enum(CATEGORY_IDS),
  rescuePrice: z.number().int().min(1).max(100_000),
  originalPrice: z.number().int().min(0).max(100_000).nullable().optional(),
  quantity: z.number().int().min(1).max(999),
  pickupEnd: z.string().regex(HHMM),
  keywords: z.string().trim().max(100).optional(),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
