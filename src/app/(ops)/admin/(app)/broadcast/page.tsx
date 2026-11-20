import Link from "next/link";
import { CheckAll, CopyButton, SubmitButton } from "@/components/ops/client";
import { channelLabel } from "@/components/ops/phase";
import { Badge, Card, Empty, Field, Flash, buttonClass, inputClass } from "@/components/ops/ui";
import { fmtDateTime } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { isEmailConfigured } from "@/lib/ops/email";
import { isLineConfigured, lineShareUrl } from "@/lib/ops/line";
import { cn } from "@/lib/utils";
import { broadcastAction, deleteBroadcastAction } from "../../actions";

export const metadata = { title: "全体連絡" };

export default async function BroadcastPage({ searchParams }: { searchParams: Promise<{ flash?: string; to?: string; sent?: string }> }) {
  const { flash, to, sent } = await searchParams;
  const audience = to === "restaurants" ? "restaurants" : "creators";
  const [creators, restaurants, history] = await Promise.all([db.list("creators"), db.list("restaurants"), db.list("broadcasts")]);
  const line = isLineConfigured();
  const mail = isEmailConfigured();
  const people =
    audience === "creators"
      ? creators
          .filter((c) => c.active)
          .sort((a, b) => a.name.localeCompare(b.name, "ja"))
          .map((c) => ({ id: c.id, name: c.name, sub: c.account ? `@${c.account}` : "", via: line && c.lineUserId ? "line" : mail && c.email ? "email" : null }))
      : restaurants
          .sort((a, b) => a.name.localeCompare(b.name, "ja"))
          .map((r) => ({ id: r.id, name: r.name, sub: r.contactName ? `${r.contactName}様` : "", via: line && (r.lineGroupId || r.lineUserId) ? "line" : mail && r.email ? "email" : null }));
  const viaLine = people.filter((p) => p.via === "line").length;
  const viaMail = people.filter((p) => p.via === "email").length;
  const none = people.filter((p) => !p.via).length;
  const list = history.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);
  const tab = (key: "creators" | "restaurants", label: string) => (
    <Link
      href={key === "creators" ? "/admin/broadcast" : "/admin/broadcast?to=restaurants"}
      aria-current={audience === key ? "page" : undefined}
      className={cn("rounded-full border px-4 py-1.5 text-sm font-bold", audience === key ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}
    >
      {label}
    </Link>
  );

  return (
    <>
      <Flash text={flash} />
      <h1 className="text-xl font-extrabold md:text-2xl">全体連絡</h1>
      <p className="text-sm text-muted">案件に関係なく、発信者や飲食店にまとめてお知らせを送れます（例：年末年始のお休み、新しいルール、募集のお知らせ）。宛名と署名は自動で付きます。</p>

      <Card>
        <div className="mb-4 flex gap-2">
          {tab("creators", "発信者に送る")}
          {tab("restaurants", "飲食店に送る")}
        </div>
        <form id="broadcast-form" action={broadcastAction} className="space-y-4">
          <input type="hidden" name="audience" value={audience} />
          <Field label="件名" required hint="本文の最初に【件名】として入り、メールの件名にもなります">
            <input name="title" required maxLength={60} placeholder="例：年末年始のお休みについて" className={inputClass} />
          </Field>
          <Field label="本文" required>
            <textarea name="body" required rows={7} placeholder={"例）いつもありがとうございます！\n12/29〜1/3はお休みをいただきます。期間中のご連絡は1/4以降に順次お返事します。"} className={inputClass} />
          </Field>
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">
                送る相手（{audience === "creators" ? "依頼対象の発信者" : "飲食店"}・{people.length}件）
              </p>
              <CheckAll formId="broadcast-to" name="to" />
            </div>
            {people.length === 0 ? (
              <Empty>送れる相手がいません。</Empty>
            ) : (
              <ul id="broadcast-to" className="grid max-h-80 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {people.map((p) => (
                  <li key={p.id}>
                    <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                      <input type="checkbox" name="to" value={p.id} defaultChecked className="size-4 accent-[var(--brand)]" />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate">{p.name}</b>
                        {p.sub && <span className="block truncate text-xs text-muted">{p.sub}</span>}
                      </span>
                      {p.via === "line" ? <Badge tone="green">LINE</Badge> : p.via === "email" ? <Badge tone="blue">メール</Badge> : <Badge tone="red">送れません</Badge>}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-xs text-muted">
              全員を選んだ場合：公式LINE {viaLine}件・メール {viaMail}件{none ? `・自動で送れない ${none}件（送ったあとに文面をコピーして送れます）` : ""}。
              公式LINEは1人に送るごとに1通として数えられます（月の上限に注意）。
            </p>
          </div>
          <SubmitButton confirm="チェックした相手に全体連絡を送ります。送ったあとは取り消せません。よろしいですか？">チェックした相手に送る</SubmitButton>
        </form>
      </Card>

      <Card title="これまでの全体連絡">
        {list.length === 0 ? (
          <Empty>まだ全体連絡は送っていません。</Empty>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {list.map((b) => {
              const ok = b.results.filter((r) => r.ok);
              const ng = b.results.filter((r) => !r.ok);
              return (
                <li key={b.id} className="py-3">
                  <details open={b.id === sent && ng.length > 0}>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="num w-24 text-xs text-muted">{fmtDateTime(b.createdAt)}</span>
                      <Badge>{b.audience === "creators" ? "発信者" : "飲食店"}</Badge>
                      <b>{b.title}</b>
                      <span className="ml-auto flex gap-1.5">
                        <Badge tone="green">送信 {ok.length}</Badge>
                        {ng.length > 0 && <Badge tone="red">送れず {ng.length}</Badge>}
                      </span>
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-mist p-3 text-xs leading-relaxed">{b.body}</pre>
                    <ul className="mt-2 space-y-1.5">
                      {b.results.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
                          <b className="text-sm">{r.name}</b>
                          {r.ok ? <Badge tone="green">{channelLabel[r.channel]}で送信</Badge> : <Badge tone="red">送れず</Badge>}
                          {!r.ok && (
                            <>
                              <span className="text-rose-700">{r.error}</span>
                              <CopyButton text={r.text} label="文面をコピー" />
                              <a href={lineShareUrl(r.text)} target="_blank" rel="noopener" className={buttonClass("outline", "sm")}>
                                自分のLINEで送る
                              </a>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                    <form action={deleteBroadcastAction.bind(null, b.id)} className="mt-2">
                      <SubmitButton variant="outline" size="sm" confirm="この記録を削除します（送ったメッセージは取り消せません）。よろしいですか？">
                        記録を削除
                      </SubmitButton>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
