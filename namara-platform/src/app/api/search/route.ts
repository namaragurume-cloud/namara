import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateConsumerSessionId } from "@/lib/server/consumer-session";
import { runSearch } from "@/lib/server/services/search-service";
import { limiter } from "@/lib/security/rate-limit";
import { toPublicOutcome } from "@/lib/shared/public";

const bodySchema = z.object({
  text: z.string().trim().min(1, "検索したい内容を入力してください").max(200, "200文字以内で入力してください"),
  refinedFrom: z.string().max(100).nullish(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" }, { status: 400 });
  }

  const sessionId = await getOrCreateConsumerSessionId();
  const limit = limiter("search", 30, 60_000).check(sessionId);
  if (!limit.allowed) {
    return NextResponse.json({ error: "短時間に検索が集中しました。少し待ってからお試しください。" }, { status: 429 });
  }

  try {
    const outcome = runSearch({ text: parsed.data.text, sessionId, channel: "web", refinedFrom: parsed.data.refinedFrom ?? null });
    return NextResponse.json(toPublicOutcome(outcome));
  } catch (error) {
    console.error("[search] failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "検索中にエラーが発生しました。時間をおいてお試しください。" }, { status: 500 });
  }
}
