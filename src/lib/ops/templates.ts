import "server-only";
import { fillTemplate, templateDefs, TEMPLATE_KEYS, type Msg, type TemplateKey } from "@/data/ops-templates";
import { db } from "./db";

/** 今使われる文面（管理画面で編集したものがあればそれ、なければ初期値） */
export async function currentTemplates(): Promise<Record<TemplateKey, { subject?: string; body: string; edited: boolean; updatedAt?: string }>> {
  const overrides = new Map((await db.list("templates")).map((t) => [t.id, t]));
  return Object.fromEntries(
    TEMPLATE_KEYS.map((k) => {
      const o = overrides.get(k);
      const d = templateDefs[k];
      return [k, { subject: o?.subject ?? d.subject, body: o?.body ?? d.body, edited: Boolean(o), updatedAt: o?.updatedAt }];
    }),
  ) as Record<TemplateKey, { subject?: string; body: string; edited: boolean; updatedAt?: string }>;
}

/** 文面に値を差し込んでメッセージを作る */
export async function msg(key: TemplateKey, vars: Record<string, string | undefined> = {}): Promise<Msg> {
  const t = await currentTemplates();
  const all = { 署名: t.signature.body, ...vars };
  return { subject: fillTemplate(t[key].subject ?? "", all), text: fillTemplate(t[key].body, all) };
}

export async function text(key: TemplateKey, vars: Record<string, string | undefined> = {}): Promise<string> {
  return (await msg(key, vars)).text;
}
