import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { getViewer, STORE_COOKIE } from "@/server/auth/viewer";
import { startConnectOnboarding } from "@/server/services/connect";

/** Stripe の登録リンクが期限切れになったときの戻り先（refresh_url）。新しいリンクを発行して登録画面へ戻す。 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(`${env.appUrl}/login?next=${encodeURIComponent("/store/payouts")}`);
  const selected = (await cookies()).get(STORE_COOKIE)?.value;
  const store = viewer.memberships.find((m) => m.storeId === selected) ?? viewer.memberships[0];
  if (!store) return NextResponse.redirect(`${env.appUrl}/`);
  try {
    return NextResponse.redirect(await startConnectOnboarding(viewer.id, store.storeId));
  } catch (error) {
    console.error("[connect] refresh link failed", error);
    return NextResponse.redirect(`${env.appUrl}/store/payouts?error=1`);
  }
}
