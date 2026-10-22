import Link from "next/link";
import { BarChart3, MessageCircle, ShieldCheck } from "lucide-react";
import { DemoAccountSwitcher } from "@/components/layout/DemoAccountSwitcher";
import { Badge, Notice } from "@/components/ui/primitives";
import { getCurrentDemoAccount, isDemoModeEnabled } from "@/lib/server/demo-session";

export default async function PortalPage() {
  const account = await getCurrentDemoAccount();
  const demo = isDemoModeEnabled();

  const services = [
    { href: "/ai", icon: MessageCircle, name: "なまらAI", tag: "消費者向け・無料", body: "LINEで話しかけるように、北海道のお店を探せるグルメ検索。Web版チャットのデモです。" },
    { href: "/review", icon: BarChart3, name: "NAMARA REVIEW", tag: "飲食店向けSaaS", body: "口コミ・検索需要・広告をまとめて管理し、AI店長が改善アクションを提案します。" },
    { href: "/admin", icon: ShieldCheck, name: "運営管理", tag: "なまらグルメ運営専用", body: "店舗マスター、広告審査、検索需要、契約状況を管理します。" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="navy">NAMARA PLATFORM</Badge>
        <Badge tone="ad">開発デモ（モック）</Badge>
      </div>
      <h1 className="mt-4 text-2xl font-bold leading-snug text-ink sm:text-3xl">
        北海道の「食べたい」を、
        <br className="sm:hidden" />
        お店の集客と改善へ。
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
        なまらグルメが運営する、消費者向けグルメ検索「なまらAI」と、飲食店向けSaaS「NAMARA REVIEW」の統合プラットフォームです。
      </p>

      <div className="mt-6">
        <Notice tone="warn">
          このデモに登場する店舗・口コミ・検索データはすべて<strong>架空</strong>です。外部API（LINE・Google・OpenAI・Supabase）には接続していません。
        </Notice>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {services.map(({ href, icon: Icon, name, tag, body }) => (
          <Link key={href} href={href} className="group rounded-xl border border-line bg-paper p-5 shadow-sm transition-colors hover:border-blue">
            <Icon className="size-6 text-navy" aria-hidden />
            <p className="mt-3 text-lg font-bold text-ink group-hover:text-blue">{name}</p>
            <p className="text-xs font-medium text-muted">{tag}</p>
            <p className="mt-2 text-sm text-ink/80">{body}</p>
          </Link>
        ))}
      </div>

      <section className="mt-10 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-bold text-ink">デモアカウントで画面を確認する</h2>
        <p className="mt-1 text-sm text-muted">
          権限ごとに見える範囲が変わります（店舗ユーザーは自店のみ、運営は全体）。
          {account && (
            <>
              現在：<strong className="text-ink">{account.label}</strong>
            </>
          )}
        </p>
        <div className="mt-4">{demo ? <DemoAccountSwitcher currentKey={account?.key} /> : <p className="text-sm text-muted">本番モードではデモログインは無効です。</p>}</div>
      </section>

      <footer className="mt-10 flex flex-wrap gap-4 text-xs text-muted">
        <Link href="/privacy" className="underline">プライバシーポリシー（草案）</Link>
        <Link href="/terms" className="underline">利用規約（草案）</Link>
        <span>運営：なまらグルメ</span>
      </footer>
    </main>
  );
}
