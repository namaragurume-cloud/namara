import "server-only";
import { escapeHtml } from "./utils";

/**
 * フォーム通知メールの送信。
 *
 * MAIL_PROVIDER で送信方式を切り替えます。
 *   - resend    : Resend API（RESEND_API_KEY / MAIL_FROM / MAIL_TO）
 *   - formspree : Formspree（FORMSPREE_CONTACT_FORM_ID / FORMSPREE_PARTNER_FORM_ID）
 *   - console   : サーバーのログに出力（ローカル開発専用。本番では無効）
 *
 * 未設定・設定不備の場合は送信しません（成功を装わない）。
 */

export type FormKind = "contact" | "partner";

export type MailMessage = {
  kind: FormKind;
  subject: string;
  replyTo: string;
  /** 項目名と値の一覧（メール本文に整形） */
  fields: [label: string, value: string][];
};

type Provider = "resend" | "formspree" | "console";

export class MailError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_CONFIGURED" | "SEND_FAILED",
  ) {
    super(message);
  }
}

function provider(): Provider | null {
  const p = (process.env.MAIL_PROVIDER || "").trim().toLowerCase();
  if (p === "resend" || p === "formspree") return p;
  if (p === "console" && process.env.NODE_ENV !== "production") return p;
  return null;
}

/** フォームを送信可能な状態かどうか（ページ表示時に判定） */
export function isMailConfigured(kind: FormKind): boolean {
  switch (provider()) {
    case "resend":
      return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM && process.env.MAIL_TO);
    case "formspree":
      return Boolean(formspreeId(kind));
    case "console":
      return true;
    default:
      return false;
  }
}

/** 発信者登録用の ID が未設定なら、企業問い合わせ用のフォームを共用（件名で区別） */
function formspreeId(kind: FormKind): string | undefined {
  const contact = process.env.FORMSPREE_CONTACT_FORM_ID?.trim();
  const partner = process.env.FORMSPREE_PARTNER_FORM_ID?.trim();
  return (kind === "partner" ? partner || contact : contact) || undefined;
}

function toText(msg: MailMessage): string {
  const lines = msg.fields.map(([label, value]) => `■ ${label}\n${value || "（未入力）"}\n`);
  return [`${msg.subject}`, "", ...lines, "---", `送信日時: ${now()}`].join("\n");
}

function toHtml(msg: MailMessage): string {
  const rows = msg.fields
    .map(
      ([label, value]) =>
        `<tr><th style="text-align:left;vertical-align:top;padding:10px 16px 10px 0;white-space:nowrap;color:#666;font-weight:600;border-bottom:1px solid #eee">${escapeHtml(label)}</th><td style="padding:10px 0;border-bottom:1px solid #eee;white-space:pre-wrap">${escapeHtml(value || "（未入力）")}</td></tr>`,
    )
    .join("");
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#111"><h2 style="font-size:16px;margin:0 0 16px">${escapeHtml(msg.subject)}</h2><table style="border-collapse:collapse;width:100%">${rows}</table><p style="color:#999;font-size:12px;margin-top:24px">送信日時: ${now()}</p></div>`;
}

function now(): string {
  return new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export async function sendMail(msg: MailMessage): Promise<void> {
  const p = provider();
  if (!p || !isMailConfigured(msg.kind)) {
    throw new MailError("Mail provider is not configured", "NOT_CONFIGURED");
  }

  const signal = AbortSignal.timeout(10_000);

  try {
    if (p === "console") {
      console.info(`\n[mail:console] ----\n${toText(msg)}\n[mail:console] reply-to: ${msg.replyTo}\n`);
      return;
    }

    if (p === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM,
          to: process.env.MAIL_TO!.split(",").map((s) => s.trim()),
          reply_to: msg.replyTo,
          subject: msg.subject,
          text: toText(msg),
          html: toHtml(msg),
        }),
        signal,
      });
      if (!res.ok) {
        throw new Error(`Resend responded ${res.status}: ${await res.text().catch(() => "")}`);
      }
      return;
    }

    // formspree
    const res = await fetch(`https://formspree.io/f/${formspreeId(msg.kind)}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        _subject: msg.subject,
        _replyto: msg.replyTo,
        email: msg.replyTo,
        ...Object.fromEntries(msg.fields),
      }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Formspree responded ${res.status}: ${await res.text().catch(() => "")}`);
    }
  } catch (err) {
    console.error("[mail] send failed:", err);
    throw new MailError("Failed to send mail", "SEND_FAILED");
  }
}
