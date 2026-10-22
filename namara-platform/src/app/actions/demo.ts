"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, findDemoAccount, isDemoModeEnabled } from "@/lib/server/demo-session";

/** デモアカウントの切り替え（決められたアカウントのみ） */
export async function switchDemoAccount(formData: FormData) {
  if (!isDemoModeEnabled()) redirect("/");
  const account = findDemoAccount(String(formData.get("account") ?? ""));
  const store = await cookies();
  if (!account) {
    store.delete(DEMO_COOKIE);
    redirect("/");
  }
  store.set(DEMO_COOKIE, account.key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect(account.actor.kind === "operator" ? "/admin" : "/review");
}

export async function signOutDemo() {
  const store = await cookies();
  store.delete(DEMO_COOKIE);
  redirect("/");
}
