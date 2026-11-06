import Link from "next/link";
import { requireAdmin } from "@/lib/ops/auth";
import { dbMode } from "@/lib/ops/db";
import { logout } from "../actions";

const nav = [
  { href: "/admin", label: "ホーム" },
  { href: "/admin/campaigns/new", label: "＋新しい案件" },
  { href: "/admin/creators", label: "発信者" },
  { href: "/admin/restaurants", label: "飲食店" },
  { href: "/admin/messages", label: "送信履歴" },
  { href: "/admin/settings", label: "設定" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const mode = dbMode();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2">
          <Link href="/admin" className="shrink-0 py-1 text-sm font-extrabold">
            <span className="text-brand">MIRATSUMU</span> 管理
          </Link>
          <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-2.5 py-1.5 font-bold text-zinc-600 hover:bg-mist hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action={logout}>
            <button className="whitespace-nowrap text-xs text-muted hover:text-ink">ログアウト</button>
          </form>
        </div>
      </header>
      {mode === null ? (
        <div className="mx-auto max-w-3xl p-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-relaxed">
            <p className="font-bold">データの保存先が未設定です</p>
            <p className="mt-2">
              Vercel の Storage（Marketplace）から <b>Upstash Redis</b> を追加し、このプロジェクトに接続してください（無料枠で十分です）。
              接続すると環境変数 <code>KV_REST_API_URL</code> / <code>KV_REST_API_TOKEN</code> が自動で設定されます。設定後に再デプロイしてください。
            </p>
          </div>
        </div>
      ) : (
        <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">{children}</main>
      )}
    </>
  );
}
