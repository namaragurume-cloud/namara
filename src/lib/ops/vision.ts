import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { demoExtract } from "./demo";
import { isDemo } from "./demo-flag";
import { insightFields } from "./insight-fields";
import type { Dist, DistKey, MetricKey, Platform } from "./types";

/**
 * インサイトのスクショから数値を読み取る（Claude API）。
 *   ANTHROPIC_API_KEY : Anthropic の API キー（https://console.anthropic.com）
 */

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) || isDemo();
}

const MODEL = "claude-opus-5-5";

const num = z.number().nullable();
const dist = z.array(z.object({ label: z.string(), pct: z.number() }));

const ExtractSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "unknown"]),
  is_video: z.boolean().nullable(),
  posted_on: z.string().nullable(),
  views: num,
  viewers: num,
  avg_watch_sec: num,
  follows: num,
  likes: num,
  comments: num,
  shares: num,
  saves: num,
  new_viewer_pct: num,
  non_follower_pct: num,
  sources: dist,
  age: dist,
  gender: dist,
  unrelated_images: z.number(),
  note: z.string(),
});

const SYSTEM = `あなたはSNSの投稿インサイト画面のスクリーンショットから数値を正確に書き写す担当です。
複数枚の画像は、すべて同じ1つの投稿のインサイトです。画像に実際に写っている値だけを書き写し、写っていない項目は推測せず null（内訳は空配列）にしてください。

項目の対応:
- Instagram: 閲覧数→views、閲覧者→viewers、平均再生時間→avg_watch_sec（秒。「1分5秒」は65）、フォロー数→follows、いいね→likes、コメント→comments、シェア（紙飛行機）→shares、保存→saves、「フォロワー以外」の割合→non_follower_pct（「フォロワー」の割合しか写っていなければ 100 から引く）、「閲覧数の上位のソース」→sources、年齢→age、性別→gender。
- TikTok: 総視聴数（または再生数）→views、いいね→likes、コメント→comments、シェア→shares、保存（お気に入り）→saves、「新しい視聴者」の割合→new_viewer_pct、「非フォロワー」の割合→non_follower_pct、性別→gender、年齢→age、平均視聴時間→avg_watch_sec。TikTokでは viewers・follows・sources は null。

数値のルール:
- 「18K」「1.2万」などの省略表記は数値に直す（18K→18000、1.2万→12000）。同じ項目が省略表記と詳しい表記の両方で写っていれば、詳しい方（例 17.1K より 17,100 が写っていればそちら、18K と 17.1K なら 17.1K）を使う。
- 割合は % を除いた数値（72.7% → 72.7）。内訳の label は画面の表記のまま（例「フィード」「25-34」「女性」）。
- 数字が読めない・グラフしかなく値がない項目は null。
- platform は画面の見た目から判断。is_video は再生時間や再生ボタンがあれば true、写真・カルーセル投稿なら false、判断できなければ null。
- posted_on は投稿日が写っていれば YYYY-MM-DD、なければ null。
- インサイト以外の画像（関係ない写真など）の枚数を unrelated_images に入れる。
- note には読み取りで気になった点（ぼやけて読めない、別の投稿が混ざっている可能性など）を日本語で短く。なければ空文字。`;

export type Extracted = {
  platform: Platform | null;
  isVideo?: boolean;
  postedOn?: string;
  metrics: Partial<Record<MetricKey, number>>;
  dists: Partial<Record<DistKey, Dist>>;
  unrelatedImages: number;
  note: string;
};

type Img = { mediaType: string; base64: string };

export async function extractInsight(images: Img[], hint?: Platform): Promise<Extracted> {
  if (isDemo() && !process.env.ANTHROPIC_API_KEY) return demoExtract(images.length);
  const client = new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = images.map((im) => ({
    type: "image",
    source: { type: "base64", media_type: im.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: im.base64 },
  }));
  content.push({
    type: "text",
    text: `${images.length}枚のスクリーンショットから数値を書き写してください。${hint ? `（発信者の申告では${hint === "instagram" ? "Instagram" : "TikTok"}の投稿です）` : ""}`,
  });

  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    // 安全判定で断られた場合はサーバー側で別モデルに引き継ぐ
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(ExtractSchema) },
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error("読み取りを断られました");
  const o = res.parsed_output;
  if (!o) throw new Error(`読み取り結果を解析できませんでした（${res.stop_reason}）`);

  const platform: Platform | null = o.platform === "unknown" ? (hint ?? null) : o.platform;
  const metrics: Partial<Record<MetricKey, number>> = {};
  const put = (k: MetricKey, v: number | null) => {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) metrics[k] = v;
  };
  put("views", o.views);
  put("viewers", o.viewers);
  put("avgWatchSec", o.avg_watch_sec);
  put("follows", o.follows);
  put("likes", o.likes);
  put("comments", o.comments);
  put("shares", o.shares);
  put("saves", o.saves);
  put("newViewerPct", o.new_viewer_pct);
  put("nonFollowerPct", o.non_follower_pct);
  // その媒体にない項目は捨てる
  if (platform) {
    const allowed = new Set<string>(insightFields[platform].map((f) => f.key));
    for (const k of Object.keys(metrics) as MetricKey[]) if (!allowed.has(k)) delete metrics[k];
  }
  const clean = (d: Dist) => d.filter((x) => x.label && Number.isFinite(x.pct) && x.pct >= 0 && x.pct <= 100);
  const dists: Partial<Record<DistKey, Dist>> = {};
  if (o.sources.length && platform !== "tiktok") dists.sources = clean(o.sources);
  if (o.age.length) dists.age = clean(o.age);
  if (o.gender.length) dists.gender = clean(o.gender);

  return {
    platform,
    isVideo: o.is_video ?? undefined,
    postedOn: o.posted_on && /^\d{4}-\d{2}-\d{2}$/.test(o.posted_on) ? o.posted_on : undefined,
    metrics,
    dists,
    unrelatedImages: o.unrelated_images,
    note: o.note,
  };
}
