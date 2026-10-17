import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { demoLoginAction } from "@/app/actions/auth";
import { Logo } from "@/components/ui/Logo";
import { Notice } from "@/components/ui/Section";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { brand } from "@/lib/brand";
import { errorMessage } from "@/lib/errors";
import { safeNextPath } from "@/server/auth/line";
import { getViewer } from "@/server/auth/viewer";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "ログイン", robots: { index: false } };

const DEMO = [
  { account: "user", label: "ユーザー", body: "商品を予約して、QRで食べつなぎ完了まで" },
  { account: "storeOwner", label: "店舗オーナー", body: "大通ベーカリー（STANDARD）の出品・売上・QR" },
  { account: "storeStaff", label: "店舗スタッフ", body: "すすきのデリ（FREE）の出品・予約確認" },
  { account: "admin", label: "管理者", body: "KPI・店舗・予約・No Show・通知" },
] as const;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNextPath(rawNext, "/");
  if (await getViewer()) redirect(next);

  const lineEnabled = env.line.loginEnabled;
  const liff = Boolean(env.line.liffId);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-10">
      <Link href="/" className="self-start">
        <Logo sub />
      </Link>
      <div className="mt-12">
        <h1 className="whitespace-pre-line text-[24px] font-bold leading-snug">{brand.copy}</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">予約とQRチェックインのために、ログインしてください。取得するのはLINEの表示名とユーザーIDのみです。</p>
      </div>

      <div className="mt-8 space-y-3">
        {error && <Notice tone="error">{errorMessage(error)}</Notice>}
        {lineEnabled ? (
          <a
            href={`/api/auth/line?next=${encodeURIComponent(next)}`}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#06C755] text-[16px] font-bold text-white hover:brightness-95"
          >
            LINEでログイン
          </a>
        ) : (
          <Notice>LINEログインは準備中です（LINE_CHANNEL_ID / LINE_CHANNEL_SECRET が未設定）。</Notice>
        )}
        {liff && <p className="text-center text-[12px] text-muted">LINEアプリ内で開いている場合は、自動でログインします。</p>}
      </div>

      {env.demoLoginEnabled && (
        <section className="mt-10 rounded-3xl border border-dashed border-line bg-canvas p-5">
          <p className="text-[12px] font-bold tracking-[0.15em] text-clay">DEMO LOGIN</p>
          <p className="mt-1 text-[12px] text-muted">開発・確認用です。本番環境（APP_ENV=production）では表示されません。</p>
          <div className="mt-4 space-y-2">
            {DEMO.map((d) => (
              <form key={d.account} action={demoLoginAction}>
                <input type="hidden" name="account" value={d.account} />
                <input type="hidden" name="next" value={rawNext ? next : ""} />
                <SubmitButton variant="secondary" className="h-auto w-full flex-col items-start rounded-2xl px-4 py-3 text-left" pendingLabel="ログイン中…">
                  <span className="text-[14px] font-bold">{d.label}としてログイン</span>
                  <span className="text-[11.5px] font-normal text-muted">{d.body}</span>
                </SubmitButton>
              </form>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
