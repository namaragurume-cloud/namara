import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { AppError } from "@/lib/errors";
import { asService } from "../db";
import { readSessionUserId } from "./session";

export type Membership = {
  storeId: string;
  storeName: string;
  storeSlug: string;
  role: "owner" | "staff";
  plan: "free" | "standard";
  status: "pending" | "active" | "suspended";
};

export type Viewer = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  lineLinked: boolean;
  isDemo: boolean;
  isAdmin: boolean;
  memberships: Membership[];
};

export const STORE_COOKIE = "tt_store";

/** 現在のログインユーザー（リクエスト単位でキャッシュ） */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;
  return asService(async (q) => {
    const [user] = await q.query<{
      id: string;
      display_name: string;
      avatar_url: string | null;
      line_user_id: string | null;
      is_demo: boolean;
      is_admin: boolean;
      stale: boolean;
    }>(
      `select u.id, u.display_name, u.avatar_url, u.line_user_id, u.is_demo,
              exists (select 1 from public.admin_users a where a.user_id = u.id) as is_admin,
              (u.last_seen_at is null or u.last_seen_at < now() - interval '1 hour') as stale
       from public.users u where u.id = $1`,
      [userId],
    );
    if (!user) return null;
    if (user.stale) {
      // MAU 集計用（1時間に1回だけ更新）
      await q.query("update public.users set last_seen_at = now() where id = $1", [userId]);
    }
    const memberships = await q.query<{
      store_id: string;
      name: string;
      slug: string;
      role: "owner" | "staff";
      plan_code: "free" | "standard";
      status: "pending" | "active" | "suspended";
    }>(
      `select m.store_id, s.name, s.slug, m.role, s.plan_code, s.status
       from public.store_members m join public.stores s on s.id = m.store_id
       where m.user_id = $1 order by s.name`,
      [userId],
    );
    return {
      id: user.id,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      lineLinked: Boolean(user.line_user_id),
      isDemo: user.is_demo,
      isAdmin: user.is_admin,
      memberships: memberships.map((m) => ({
        storeId: m.store_id,
        storeName: m.name,
        storeSlug: m.slug,
        role: m.role,
        plan: m.plan_code,
        status: m.status,
      })),
    };
  });
});

/** ログイン必須。未ログインならログイン画面へ（戻り先付き） */
export async function requireViewer(nextPath: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return viewer;
}

/** 店舗メンバー必須。選択中の店舗（Cookie）を返す。メンバーでなければ 404。 */
export async function requireStoreMember(nextPath = "/store"): Promise<{ viewer: Viewer; store: Membership }> {
  const viewer = await requireViewer(nextPath);
  if (viewer.memberships.length === 0) notFound();
  const selected = (await cookies()).get(STORE_COOKIE)?.value;
  const store = viewer.memberships.find((m) => m.storeId === selected) ?? viewer.memberships[0];
  return { viewer, store };
}

/** 指定店舗のメンバーであることを検証する（Server Action 用） */
export async function assertStoreMember(storeId: string, opts: { owner?: boolean } = {}) {
  const viewer = await getViewer();
  const membership = viewer?.memberships.find((m) => m.storeId === storeId);
  if (!viewer || !membership || (opts.owner && membership.role !== "owner")) {
    throw new AppError("forbidden");
  }
  return { viewer, store: membership };
}

/** 管理者必須。管理者以外には存在自体を見せない（404） */
export async function requireAdmin(nextPath = "/admin"): Promise<Viewer> {
  const viewer = await requireViewer(nextPath);
  if (!viewer.isAdmin) notFound();
  return viewer;
}

export async function assertAdmin() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) {
    throw new AppError("forbidden");
  }
  return viewer;
}
