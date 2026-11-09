import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { db } from "./db";
import { isDemo } from "./demo-flag";
import { isComplete } from "./insight-fields";
import type { Creator, ProposalText, Restaurant } from "./types";

/**
 * 飲食店への提案資料の文章をAIで作る。
 * 料金はAIに渡さず、AIにも書かせない（料金は設定値からツールが計算する）。
 * 実績はこのツールに記録された数字だけを渡し、効果の約束はさせない。
 */

const Schema = z.object({
  title: z.string(),
  catchcopy: z.string(),
  summary: z.string(),
  points: z.array(z.object({ title: z.string(), body: z.string() })),
  reasons: z.array(z.object({ creator_id: z.string(), reason: z.string() })),
  light_plan: z.object({ creator_ids: z.array(z.string()), reason: z.string() }).nullable(),
});

const SYSTEM = `あなたは北海道のインフルエンサーキャスティング会社「MIRATSUMU（なまらグルメが運営）」の営業担当です。
飲食店のオーナーに向けて、SNS（Instagram・TikTok）のPRを提案する資料の文章を書きます。

ルール:
- 渡された情報（お店の情報・担当者のメモ・発信者のプロフィールと実績）だけを使う。書かれていない事実・数字を作らない。
- 「売上が上がる」「必ず集客できる」など、効果を約束・断定しない（「〜が期待できます」「〜につながる発信」程度）。
- 料金・金額は一切書かない（料金表は別に載せる）。
- 丁寧で分かりやすい日本語。飲食店のオーナーが30秒で読める長さ。
- title：提案のタイトル（30字以内。例「〇〇様 冬の新メニュー SNSプロモーションのご提案」）
- catchcopy：表紙のひとこと（25字以内）
- summary：提案の概要（2〜3文、120字程度）
- points：提案のポイントを3つ（title 15字以内、body 1〜2文）
- reasons：発信者ごとに、このお店に合う理由（1〜2文。プロフィールと実績にもとづく）。すべての発信者について書く。creator_id は渡されたIDをそのまま使う
- light_plan：発信者が3人以上なら、予算を抑えたい場合の少人数プラン（全体の半分程度の人数）を選び、選んだ理由を1文で。2人以下なら null`;

export type ProposalInput = {
  restaurant: Restaurant;
  request?: string;
  creators: Creator[];
};

/** 発信者ごとの、このツールに記録された実績（インサイトがそろった投稿だけ） */
export async function creatorTrack(creatorIds: string[]) {
  const all = (await db.list("assignments")).filter((a) => creatorIds.includes(a.creatorId) && isComplete(a.insight));
  const out = new Map<string, { posts: number; avgViews: number }>();
  for (const id of creatorIds) {
    const list = all.filter((a) => a.creatorId === id);
    const views = list.map((a) => a.insight!.metrics.views ?? 0).filter((v) => v > 0);
    if (views.length) out.set(id, { posts: views.length, avgViews: Math.round(views.reduce((x, y) => x + y, 0) / views.length) });
  }
  return out;
}

function demoText({ restaurant, creators }: ProposalInput): ProposalText {
  return {
    title: `${restaurant.name}様 SNSプロモーションのご提案`,
    catchcopy: "北海道のグルメ発信者と、お店の魅力を届けます",
    summary: `（デモの文章です）${creators.length}名の発信者が実際にお店を訪れ、料理と雰囲気をInstagram・TikTokで紹介します。フォロワー以外の方にも届く発信で、新しいお客様との接点づくりをお手伝いします。`,
    points: [
      { title: "実際に来店して発信", body: "発信者が実際にお店で食事をし、リアルな感想とともに紹介します。" },
      { title: "撮影・投稿の管理は当社で", body: "日程調整から投稿の確認まで当社が行うので、お店の手間はほとんどありません。" },
      { title: "結果をレポート", body: "投稿後に閲覧数や反応をまとめたレポートをお送りします。" },
    ],
    reasons: Object.fromEntries(creators.map((c) => [c.id, `（デモ）${c.pitch || "北海道のグルメを中心に発信しています。"}`])),
    lightPlan: creators.length >= 3 ? { creatorIds: creators.slice(0, Math.ceil(creators.length / 2)).map((c) => c.id), reason: "（デモ）フォロワーの多い方を中心にした、予算を抑えたプランです。" } : undefined,
  };
}

export async function draftProposal(input: ProposalInput): Promise<ProposalText> {
  if (isDemo() && !process.env.ANTHROPIC_API_KEY) return demoText(input);
  const stats = await creatorTrack(input.creators.map((c) => c.id));
  const r = input.restaurant;
  const data = {
    お店: { 店名: r.name, 住所: r.address, 食べログ: r.tabelogUrl, Instagram: r.instagramUrl },
    担当者のメモ: input.request || "（特になし）",
    発信者: input.creators.map((c) => ({
      creator_id: c.id,
      名前: c.name,
      アカウント: c.account ? `@${c.account}` : undefined,
      媒体: c.platform,
      フォロワー数: c.followers,
      プロフィール: c.pitch,
      このツールでの実績: stats.get(c.id) ? `PR投稿${stats.get(c.id)!.posts}件・平均閲覧数${stats.get(c.id)!.avgViews.toLocaleString("ja-JP")}回` : "記録なし",
    })),
  };
  const client = new Anthropic();
  const res = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(Schema) },
    messages: [{ role: "user", content: `提案の材料:\n${JSON.stringify(data, null, 1)}` }],
  });
  const o = res.parsed_output;
  if (res.stop_reason === "refusal" || !o) throw new Error("提案資料を作れませんでした");
  const ids = new Set(input.creators.map((c) => c.id));
  const light = o.light_plan?.creator_ids.filter((id) => ids.has(id)) ?? [];
  return {
    title: o.title,
    catchcopy: o.catchcopy,
    summary: o.summary,
    points: o.points.slice(0, 4),
    reasons: Object.fromEntries(o.reasons.filter((x) => ids.has(x.creator_id)).map((x) => [x.creator_id, x.reason])),
    lightPlan: light.length && light.length < ids.size ? { creatorIds: light, reason: o.light_plan!.reason } : undefined,
  };
}
