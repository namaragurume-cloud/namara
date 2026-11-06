import "server-only";

/**
 * 発信者・飲食店へのメール送信（Resend）。
 * サイトのフォーム通知と同じ RESEND_API_KEY / MAIL_FROM を使います。
 * Formspree では任意の宛先に送れないため、ここでは Resend のみ対応です。
 * ローカル開発で MAIL_PROVIDER=console のときはターミナルに表示します（送信扱い）。
 */

export function isEmailConfigured(): boolean {
  const p = (process.env.MAIL_PROVIDER || "").trim().toLowerCase();
  if (p === "console" && process.env.NODE_ENV !== "production") return true;
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const p = (process.env.MAIL_PROVIDER || "").trim().toLowerCase();
  if (p === "console" && process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) {
    console.info(`\n[ops-mail:console] to: ${to}\n件名: ${subject}\n${text}\n`);
    return;
  }
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) throw new Error("メール送信が未設定です");
  const replyTo = process.env.MAIL_TO?.split(",")[0]?.trim();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
}
