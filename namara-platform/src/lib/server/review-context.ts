/**
 * NAMARA REVIEW 画面の共通処理：ログイン中のユーザーと、表示してよい店舗を決める。
 */
import "server-only";
import type { Store } from "@/lib/shared/types";
import { canAccessStore, type Actor } from "./authz";
import { getCurrentActor, getCurrentDemoAccount } from "./demo-session";
import { listAccessibleStores } from "./services/dashboard-service";

export type ReviewContext =
  | { ok: true; actor: Actor; store: Store; stores: Store[]; accountLabel: string }
  | { ok: false; reason: string };

export async function resolveReviewContext(requestedStoreId: string | undefined): Promise<ReviewContext> {
  const actor = await getCurrentActor();
  if (actor.kind === "anonymous") return { ok: false, reason: "NAMARA REVIEW を使うには店舗アカウントでログインしてください。" };
  const stores = listAccessibleStores(actor);
  const storeId = requestedStoreId ?? stores[0]?.id;
  if (!storeId || !canAccessStore(actor, storeId)) return { ok: false, reason: "この店舗のデータを見る権限がありません。" };
  const store = stores.find((s) => s.id === storeId);
  if (!store) return { ok: false, reason: "店舗が見つかりません。" };
  const account = await getCurrentDemoAccount();
  return { ok: true, actor, store, stores, accountLabel: account?.label ?? "" };
}
