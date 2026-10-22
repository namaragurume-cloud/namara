/**
 * デモ用ログイン（モック認証）。
 *
 * Supabase Auth を接続するまでの間、画面の権限分離を確認するための仕組みです。
 * - 決められたデモアカウントだけを選べる（任意の値は受け付けない）
 * - 本番ビルドでは NAMARA_DEMO_MODE=1 を設定しない限り無効（誰でも運営者になれてしまうため）
 */
import "server-only";
import { cookies } from "next/headers";
import type { Actor } from "./authz";

export const DEMO_COOKIE = "namara_demo_actor";

export type DemoAccount = { key: string; label: string; description: string; actor: Actor };

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: "owner-org1",
    label: "店舗オーナー（架空フードサービス）",
    description: "2店舗（store-001 / store-002）を管理するオーナー",
    actor: { kind: "store_member", userId: "demo-user-owner-1", organizationId: "org-demo-1", storeIds: ["store-001", "store-002"], role: "owner" },
  },
  {
    key: "staff-org1",
    label: "店舗スタッフ（閲覧のみ）",
    description: "store-001 のみ閲覧できるスタッフ",
    actor: { kind: "store_member", userId: "demo-user-staff-1", organizationId: "org-demo-1", storeIds: ["store-001"], role: "staff" },
  },
  {
    key: "owner-org2",
    label: "店舗オーナー（架空ダイニング）",
    description: "1店舗（store-003）を管理するオーナー",
    actor: { kind: "store_member", userId: "demo-user-owner-2", organizationId: "org-demo-2", storeIds: ["store-003"], role: "owner" },
  },
  {
    key: "operator",
    label: "なまらグルメ運営",
    description: "全店舗・広告審査・運営ダッシュボード",
    actor: { kind: "operator", userId: "demo-operator" },
  },
];

export function isDemoModeEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.NAMARA_DEMO_MODE === "1";
}

export function findDemoAccount(key: string | undefined): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.key === key);
}

export async function getCurrentActor(): Promise<Actor> {
  // Cookie を先に読むことで、ビルド時に静的ページとして固定されないようにする
  const store = await cookies();
  if (!isDemoModeEnabled()) return { kind: "anonymous" };
  return findDemoAccount(store.get(DEMO_COOKIE)?.value)?.actor ?? { kind: "anonymous" };
}

export async function getCurrentDemoAccount(): Promise<DemoAccount | undefined> {
  const store = await cookies();
  if (!isDemoModeEnabled()) return undefined;
  return findDemoAccount(store.get(DEMO_COOKIE)?.value);
}
