import "server-only";
import { sanitizeAiDescription, templateDescription, type DescriptionInput } from "@/lib/ai-copy";
import { categoryLabel } from "@/lib/categories";
import { asService, asUser } from "../db";
import { env } from "../env";
import { logEvent } from "./events";

/** プランごとの1日あたり OpenAI 生成回数（超えたらテンプレート生成に切り替える） */
const DAILY_AI_LIMIT = { free: 5, standard: 50 } as const;

const SYSTEM_PROMPT = `あなたは「TABETUNAGU（食べつなぐ）」の商品紹介文を書くコピーライターです。
TABETUNAGU は、お店でまだおいしく食べられる食品を、次に食べる人へ「つなぐ」サービスです。

ルール:
- 2〜3文、全体で120文字前後。改行で文を区切る。
- 自然で温かい日本語。煽りすぎない。絵文字・記号の多用はしない。
- 「おいしい」「お得」「次につなぐ」を自然に伝える。
- 社会課題や罪悪感を押し付けない（SDGs、もったいない、廃棄などの言葉は使わない）。
- 「レスキュー」「救う」「半額」「激安」「在庫処分」は使わない。
- 受取時間と残り数量を必ず含める。
- 入力にない具体的な中身（具材・産地など）を勝手に作らない。
- 出力は紹介文のみ。`;

function userPrompt(input: DescriptionInput, storeCategory: string) {
  return [
    `店舗名: ${input.storeName ?? ""}`,
    `店舗カテゴリー: ${categoryLabel(storeCategory)}`,
    `商品名: ${input.name}`,
    `種類: ${input.isBox ? "食べつなぎBOX（中身は当日のお楽しみ）" : "単品"}`,
    `商品カテゴリー: ${categoryLabel(input.category)}`,
    input.originalPrice ? `通常価格: ${input.originalPrice}円相当` : "",
    `食べつなぎ価格: ${input.rescuePrice}円`,
    `数量: ${input.quantity}${input.isBox ? "BOX" : "点"}`,
    `受取終了: ${input.pickupEnd}`,
    input.keywords ? `お店からのひとこと: ${input.keywords}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callOpenAI(input: DescriptionInput, storeCategory: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.openai.apiKey}` },
      body: JSON.stringify({
        model: env.openai.model,
        instructions: SYSTEM_PROMPT,
        input: userPrompt(input, storeCategory),
        max_output_tokens: 600,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[ai] OpenAI error", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as {
      output_text?: string;
      output?: { type?: string; content?: { type?: string; text?: string }[] }[];
    };
    if (data.output_text) return data.output_text;
    const text = data.output
      ?.flatMap((o) => o.content ?? [])
      .filter((c) => c.type === "output_text" && c.text)
      .map((c) => c.text)
      .join("");
    return text || null;
  } catch (error) {
    console.error("[ai] OpenAI request failed", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type GeneratedDescription = { text: string; provider: "openai" | "template" };

/** 商品紹介文を生成する（OpenAI → 失敗・未設定・上限超過時はテンプレート） */
export async function generateProductDescription(
  userId: string,
  store: { id: string; name: string; category: string; plan: "free" | "standard" },
  input: DescriptionInput,
): Promise<GeneratedDescription> {
  const started = Date.now();
  let text: string | null = null;
  let provider: GeneratedDescription["provider"] = "template";

  if (env.openai.apiKey) {
    const [{ count }] = await asService((q) =>
      q.query<{ count: number }>(
        `select count(*)::int as count from public.ai_generations
         where store_id = $1 and provider = 'openai' and created_at > now() - interval '1 day'`,
        [store.id],
      ),
    );
    if (count < DAILY_AI_LIMIT[store.plan]) {
      text = sanitizeAiDescription(await callOpenAI({ ...input, storeName: store.name }, store.category));
      if (text) provider = "openai";
    }
  }
  if (!text) text = templateDescription({ ...input, storeName: store.name });

  await asUser(userId, (q) =>
    q.query(
      `insert into public.ai_generations (store_id, user_id, kind, provider, model, input, output, latency_ms)
       values ($1, $2, 'product_description', $3, $4, $5::jsonb, $6, $7)`,
      [store.id, userId, provider, provider === "openai" ? env.openai.model : null, JSON.stringify(input), text, Date.now() - started],
    ),
  ).catch((error) => console.error("[ai] failed to log generation", error));
  await logEvent("ai_description_generated", { userId, storeId: store.id, properties: { provider } });
  return { text, provider };
}
