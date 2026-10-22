import "server-only";
import { isOperator, type Actor } from "./authz";
import { getCurrentActor, getCurrentDemoAccount } from "./demo-session";

export async function resolveAdminContext(): Promise<{ ok: true; actor: Extract<Actor, { kind: "operator" }>; accountLabel: string } | { ok: false; reason: string }> {
  const actor = await getCurrentActor();
  if (!isOperator(actor)) return { ok: false, reason: "運営管理画面は、なまらグルメ運営のアカウントだけが利用できます。" };
  const account = await getCurrentDemoAccount();
  return { ok: true, actor, accountLabel: account?.label ?? "運営" };
}
