import Link from "next/link";
import { CopyButton, SubmitButton } from "@/components/ops/client";
import { Badge, Card, Field, Flash, inputClass } from "@/components/ops/ui";
import { fillTemplate, templateDefs, TEMPLATE_KEYS } from "@/data/ops-templates";
import { fmtDateTime } from "@/lib/ops/dates";
import { currentTemplates } from "@/lib/ops/templates";
import { resetTemplate, saveTemplate } from "../../../actions";

export const metadata = { title: "メッセージの文面" };

export default async function MessagesSettingsPage({ searchParams }: { searchParams: Promise<{ flash?: string }> }) {
  const { flash } = await searchParams;
  const t = await currentTemplates();
  const groups = [
    { label: "発信者へのメッセージ", keys: TEMPLATE_KEYS.filter((k) => templateDefs[k].to === "発信者" && k !== "signature") },
    { label: "飲食店へのメッセージ", keys: TEMPLATE_KEYS.filter((k) => templateDefs[k].to === "飲食店") },
    { label: "共通", keys: ["signature" as const] },
  ];
  return (
    <>
      <Flash text={flash} />
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/settings" className="text-sm text-muted">
          ← 設定
        </Link>
        <h1 className="text-xl font-extrabold md:text-2xl">メッセージの文面</h1>
      </div>
      <Card>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>
            保存するとすぐに、次に送るメッセージから新しい文面になります（送信済みのものは変わりません）。
          </li>
          <li>
            <code className="rounded bg-mist px-1">{"{発信者名}"}</code> のような <b>{"{ }"}</b> の部分は、送るときに自動で差し込まれます。各文面の下に使える項目が出ています。
          </li>
          <li>差し込む値が空のとき（例：住所が未登録）は、その行ごと送られません。</li>
          <li>「件名」はメールで送るときだけ使います（LINEでは本文だけが届きます）。</li>
        </ul>
        <nav className="mt-4 flex flex-wrap gap-2 text-xs">
          {TEMPLATE_KEYS.map((k) => (
            <a key={k} href={`#${k}`} className="rounded-full border border-line bg-white px-3 py-1 font-bold text-muted hover:text-ink">
              {templateDefs[k].title}
              {t[k].edited && " ✎"}
            </a>
          ))}
        </nav>
      </Card>

      {groups.map((g) => (
        <section key={g.label} className="space-y-4">
          <h2 className="px-1 text-base font-extrabold">{g.label}</h2>
          {g.keys.map((k) => {
            const d = templateDefs[k];
            const cur = t[k];
            const preview = fillTemplate(cur.body, { 署名: t.signature.body, ...d.vars });
            return (
              <Card
                key={k}
                className="scroll-mt-20"
                title={
                  <span id={k} className="flex flex-wrap items-center gap-2">
                    {d.title}
                    {cur.edited ? <Badge tone="blue">編集済み {cur.updatedAt && fmtDateTime(cur.updatedAt)}</Badge> : <Badge>初期の文面</Badge>}
                  </span>
                }
              >
                <p className="-mt-2 mb-3 text-xs text-muted">送るタイミング：{d.when}</p>
                <form action={saveTemplate.bind(null, k)} className="space-y-3">
                  {d.subject !== undefined && (
                    <Field label="件名（メールのとき）">
                      <input name="subject" defaultValue={cur.subject} className={inputClass} />
                    </Field>
                  )}
                  <Field label="本文">
                    <textarea name="body" defaultValue={cur.body} rows={Math.min(22, cur.body.split("\n").length + 2)} className={`${inputClass} font-sans leading-relaxed`} />
                  </Field>
                  {Object.keys(d.vars).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted">使える差し込み項目：</span>
                      {Object.keys(d.vars).map((v) => (
                        <CopyButton key={v} text={`{${v}}`} label={`{${v}}`} />
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <SubmitButton size="sm">保存</SubmitButton>
                  </div>
                </form>
                {cur.edited && (
                  <form action={resetTemplate.bind(null, k)} className="mt-2">
                    <SubmitButton variant="outline" size="sm" confirm="初期の文面に戻しますか？（今の文面は消えます）">
                      初期の文面に戻す
                    </SubmitButton>
                  </form>
                )}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-bold text-muted">プレビュー（例の値を入れた、保存済みの文面）</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-mist p-3 text-xs leading-relaxed">{preview}</pre>
                </details>
              </Card>
            );
          })}
        </section>
      ))}
    </>
  );
}
