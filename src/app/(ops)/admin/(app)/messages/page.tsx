import { CopyButton } from "@/components/ops/client";
import { channelLabel } from "@/components/ops/phase";
import { Badge, Card, Empty } from "@/components/ops/ui";
import { fmtDateTime } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";

export const metadata = { title: "送信履歴" };

export default async function MessagesPage() {
  const list = (await db.list("messages")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
  return (
    <>
      <h1 className="text-xl font-extrabold md:text-2xl">送信履歴</h1>
      <Card title="最新200件">
        {list.length === 0 ? (
          <Empty>まだ送信履歴はありません。</Empty>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {list.map((m) => (
              <li key={m.id} className="py-2.5">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="num w-24 text-xs text-muted">{fmtDateTime(m.createdAt)}</span>
                    <b>{m.toName}</b>
                    <span className="text-muted">{m.purpose}</span>
                    <span className="ml-auto">{m.ok ? <Badge tone="green">{channelLabel[m.channel]}で送信</Badge> : <Badge tone="red">未送信</Badge>}</span>
                  </summary>
                  {m.error && <p className="mt-2 text-xs text-rose-700">{m.error}</p>}
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-mist p-3 text-xs leading-relaxed">{m.text}</pre>
                  <div className="mt-2">
                    <CopyButton text={m.text} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
