import type { Metadata } from "next";

import { LoginForm } from "./login-form";
import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = { title: "ログイン" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-sidebar p-10 text-white lg:flex">
        <Logo inverted />
        <div>
          <p className="text-3xl font-bold leading-snug">
            口コミ管理は、AIにおまかせ。
            <br />
            お店はお客様に集中できる。
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-sidebar-foreground">
            Google口コミの確認・AI返信・分析をひとつに。LINEで届いた返信案を確認して承認するだけで、口コミ対応が完了します。
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground">運営：なまらグルメ</p>
      </section>
      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 lg:hidden" />
          <h1 className="text-2xl font-bold text-primary">ログイン</h1>
          <p className="mt-1 text-sm text-muted-foreground">店舗アカウントでログインしてください。</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
