import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { Badge } from "@/components/ui/Badge";
import { dateTime } from "@/lib/format";
import { listUsers } from "@/server/services/admin";

export const metadata: Metadata = { title: "ユーザー" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const users = await listUsers(q);
  return (
    <div className="space-y-5">
      <PageHeader
        title="ユーザー"
        sub="取得している個人情報は LINE の表示名・ユーザーID のみです。信頼スコアは No Show などから計算した内部指標です（ユーザーには表示しません）。"
        action={
          <form className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="表示名・ID で検索" className="field h-10 w-56 py-1" />
            <button className="rounded-full bg-ink px-4 text-[13px] font-semibold text-white">検索</button>
          </form>
        }
      />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px] text-[13px]">
          <thead className="text-left text-[12px] text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5">表示名</th>
              <th className="px-3 py-2.5">ID</th>
              <th className="px-3 py-2.5 text-right">予約</th>
              <th className="px-3 py-2.5 text-right">完了</th>
              <th className="px-3 py-2.5 text-right">キャンセル</th>
              <th className="px-3 py-2.5 text-right">No Show</th>
              <th className="px-3 py-2.5 text-right">信頼スコア</th>
              <th className="px-3 py-2.5 text-right">ポイント</th>
              <th className="px-3 py-2.5">店舗 / 権限</th>
              <th className="px-4 py-2.5">最終利用</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  <span className="font-semibold">{String(u.display_name)}</span>
                  <span className="ml-1.5 inline-flex gap-1">
                    {Boolean(u.is_admin) && <Badge tone="dark">admin</Badge>}
                    {Boolean(u.line_linked) && <Badge tone="green">LINE</Badge>}
                    {Boolean(u.is_demo) && <Badge tone="sand">demo</Badge>}
                  </span>
                </td>
                <td className="tnum select-all px-3 py-2.5 text-[11px] text-muted">{u.id}</td>
                <td className="tnum px-3 py-2.5 text-right">{String(u.reservations)}</td>
                <td className="tnum px-3 py-2.5 text-right">{String(u.completed)}</td>
                <td className="tnum px-3 py-2.5 text-right">{String(u.cancelled)}</td>
                <td className="tnum px-3 py-2.5 text-right">{String(u.no_show)}</td>
                <td className={`tnum px-3 py-2.5 text-right font-semibold ${Number(u.trust_score) < 60 ? "text-clay" : ""}`}>{String(u.trust_score)}</td>
                <td className="tnum px-3 py-2.5 text-right">{String(u.points)}</td>
                <td className="px-3 py-2.5 text-[12px]">{(u.stores as string | null) ?? "—"}</td>
                <td className="tnum px-4 py-2.5 text-[12px]">{dateTime(u.last_seen_at as string | null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
