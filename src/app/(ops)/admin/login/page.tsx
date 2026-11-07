import { redirect } from "next/navigation";
import { isAdmin, isAdminConfigured } from "@/lib/ops/auth";
import { DEMO_PASSWORD, isDemo } from "@/lib/ops/demo-flag";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "ログイン" };

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-sm">
        <p className="text-xs font-bold tracking-widest text-brand">MIRATSUMU</p>
        <h1 className="mt-1 text-xl font-bold">キャスティング管理</h1>
        {isDemo() && (
          <p className="mt-4 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-950">
            デモ環境です。パスワード <b className="num tracking-wider">{DEMO_PASSWORD}</b> でログインできます。
          </p>
        )}
        {isAdminConfigured() ? (
          <LoginForm />
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-muted">
            管理画面のパスワードが未設定です。環境変数 <code>ADMIN_PASSWORD</code>（8文字以上）を設定してください。
          </p>
        )}
      </div>
    </div>
  );
}
