import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { demoDraft } from "./demo";
import { isDemo } from "./demo-flag";
import type { Report } from "./report";
import type { Campaign, Restaurant } from "./types";

/** レポートの「サマリー・考察・次回施策のご提案」の下書きをAIで作る（担当者が確認・修正してから送る前提） */

const DraftSchema = z.object({
  summary: z.string(),
  findings: z.array(z.string()),
  proposals: z.array(z.object({ title: z.string(), body: z.string() })),
});

const SYSTEM = `あなたは北海道の飲食店向けにSNSのPR（インフルエンサー投稿）結果をまとめる担当者です。
渡された集計データだけをもとに、飲食店のオーナー向けレポートの文章の下書きを書きます。

ルール:
- データにない数字・事実は書かない。売上・来店数が増えたなど、データで確認できない効果は断定しない（「〜につながる反応」程度にとどめる）。
- 丁寧で読みやすい日本語。専門用語は避けるか短く言い換える。
- summary：表紙のサマリー。2〜3文、120字程度。投稿数・総閲覧数と、一番伝えたい特徴を入れる。
- findings：考察を3〜4個。各1〜2文。数字の根拠を入れる。
- proposals：次回施策の提案を3個。title は20字以内、body は1〜2文。データから言える範囲で具体的に。`;

export async function draftReportText(c: Campaign, restaurant: Restaurant | null, r: Report) {
  if (isDemo() && !process.env.ANTHROPIC_API_KEY) return demoDraft;
  const data = {
    店舗: restaurant?.name,
    案件: c.title,
    PR内容: c.description,
    投稿数: r.submitted,
    総閲覧数: r.views,
    反応数: r.reactions,
    いいね: r.likes,
    コメント: r.comments,
    保存: r.saves,
    シェア: r.shares,
    エンゲージメント率: r.er !== undefined ? `${(r.er * 100).toFixed(2)}%` : null,
    フォロワー以外の割合: r.nonFollowerPct !== undefined ? `${r.nonFollowerPct.toFixed(1)}%` : null,
    年齢: r.age.map((a) => `${a.label} ${a.pct.toFixed(1)}%`),
    性別: r.gender.map((g) => `${g.label} ${g.pct.toFixed(1)}%`),
    媒体別: Object.values(r.byPlatform).map((p) => ({
      媒体: p.platform,
      投稿数: p.posts.length,
      閲覧数: p.views,
      閲覧者: p.platform === "instagram" ? p.viewers : undefined,
      フォロー増加: p.platform === "instagram" ? p.follows : undefined,
      平均再生時間秒: p.avgWatchSec,
      新しい視聴者の割合: p.newViewerPct,
      非フォロワーの割合: p.nonFollowerPct,
      反応数: p.reactions,
      閲覧ソース: p.sources.map((s) => `${s.label} ${s.pct.toFixed(1)}%`),
    })),
    投稿別: r.posts.map((p) => ({ 発信者: p.creator.name, 媒体: p.platform, 閲覧数: p.views, 反応数: p.reactions, フォロワー数: p.creator.followers })),
  };

  const client = new Anthropic();
  const res = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(DraftSchema) },
    messages: [{ role: "user", content: `集計データ:\n${JSON.stringify(data, null, 1)}` }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("下書きを作れませんでした");
  return res.parsed_output;
}
