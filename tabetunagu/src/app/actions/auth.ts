"use server";

import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { safeNextPath } from "@/server/auth/line";
import { clearSessionCookie, setSessionCookie } from "@/server/auth/session";
import { asService } from "@/server/db";
import { DEMO_USERS, type DemoAccount } from "@/server/db/seed";
import { env } from "@/server/env";

/** 開発確認用のデモログイン。本番（APP_ENV=production）では常に無効。 */
export async function demoLoginAction(formData: FormData) {
  if (!env.demoLoginEnabled) throw new AppError("forbidden");
  const account = String(formData.get("account") ?? "") as DemoAccount;
  const demo = DEMO_USERS[account];
  if (!demo) throw new AppError("validation");
  const [row] = await asService((q) =>
    q.query<{ id: string }>("select id from public.users where id = $1 and is_demo", [demo.id]),
  );
  if (!row) throw new AppError("login_failed", "デモデータが投入されていません（npm run db:seed）。");
  await setSessionCookie(demo.id);
  const fallback = account === "admin" ? "/admin" : account === "storeOwner" || account === "storeStaff" ? "/store" : "/";
  redirect(safeNextPath(String(formData.get("next") ?? ""), fallback));
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/");
}
