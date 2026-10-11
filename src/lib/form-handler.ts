import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { MailError, sendMail, type FormKind, type MailMessage } from "./mail";
import { clientIp, isRateLimited, isSameOrigin, isTooFast, verifyTurnstile } from "./spam";
import { toFieldErrors } from "./validation";

export type FormResponse =
  | { ok: true }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string> };

const json = (body: FormResponse, status: number) => NextResponse.json(body, { status });

type AntiSpamFields = { website?: string; startedAt?: number; turnstileToken?: string };

/** フォーム送信 API の共通処理（検証 → Bot 対策 → メール送信） */
export async function handleFormRequest<S extends z.ZodType<AntiSpamFields & { email: string }>>(
  req: Request,
  kind: FormKind,
  schema: S,
  build: (data: z.output<S>) => Omit<MailMessage, "kind" | "replyTo">,
) {
  if (!isSameOrigin(req)) {
    return json({ ok: false, code: "FORBIDDEN", message: "不正なリクエストです。" }, 403);
  }

  const ip = clientIp(req);
  if (isRateLimited(`${kind}:${ip}`)) {
    return json(
      {
        ok: false,
        code: "RATE_LIMITED",
        message: "短時間に複数回送信されました。しばらく時間をおいてから再度お試しください。",
      },
      429,
    );
  }

  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 20_000) throw new Error("too large");
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, code: "BAD_REQUEST", message: "送信内容を読み取れませんでした。" }, 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        ok: false,
        code: "VALIDATION",
        message: "入力内容をご確認ください。",
        fieldErrors: toFieldErrors(parsed.error),
      },
      422,
    );
  }

  const data = parsed.data;

  // Bot と判定した場合も、Bot に手がかりを与えないよう成功と同じ応答を返す
  if (data.website || isTooFast(data.startedAt)) {
    return json({ ok: true }, 200);
  }

  if (!(await verifyTurnstile(data.turnstileToken ?? "", ip))) {
    return json(
      { ok: false, code: "BOT_CHECK", message: "ロボットでないことの確認に失敗しました。もう一度お試しください。" },
      400,
    );
  }

  try {
    await sendMail({ kind, replyTo: data.email, ...build(data) });
  } catch (err) {
    if (err instanceof MailError && err.code === "NOT_CONFIGURED") {
      return json(
        {
          ok: false,
          code: "NOT_CONFIGURED",
          message:
            "現在フォームの送信設定を準備中のため、送信できませんでした。お手数ですがInstagram DMからご連絡ください。",
        },
        503,
      );
    }
    return json(
      {
        ok: false,
        code: "SEND_FAILED",
        message: "送信に失敗しました。時間をおいて再度お試しいただくか、Instagram DMからご連絡ください。",
      },
      502,
    );
  }

  return json({ ok: true }, 200);
}
