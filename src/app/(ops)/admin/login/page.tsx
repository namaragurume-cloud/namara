import { redirect } from "next/navigation";
import { isAdmin, isAdminConfigured } from "@/lib/ops/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "ログイン" };

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-sm">
        <p className="text-xs font-bold tracking-widest text-brand">MIRATSUMU</p>
        <h1 className="mt-1 text-xl font-bold">キャスティング管理</h1>
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
