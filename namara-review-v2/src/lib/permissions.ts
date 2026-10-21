import type { Member, Role } from "./types";

/**
 * 店舗ユーザーの権限。Phase 2 では同じ内容を Supabase の RLS ポリシーと
 * サーバー側チェックの両方で強制する（画面の出し分けだけに頼らない）。
 * 運営（なまらグルメ）権限はこの表に含めず、別テーブル・別ロールで管理する。
 */
export type Permission =
  | "reply.edit"
  | "reply.submit"
  | "reply.approve"
  | "store.edit"
  | "policy.edit"
  | "notifications.edit"
  | "members.manage"
  | "billing.view";

const MATRIX: Record<Role, Permission[]> = {
  owner: [
    "reply.edit",
    "reply.submit",
    "reply.approve",
    "store.edit",
    "policy.edit",
    "notifications.edit",
    "members.manage",
    "billing.view",
  ],
  manager: ["reply.edit", "reply.submit", "reply.approve", "store.edit", "policy.edit", "notifications.edit"],
  staff: ["reply.edit", "reply.submit"],
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  "reply.edit": "返信案の作成・編集",
  "reply.submit": "承認依頼",
  "reply.approve": "承認してGoogleに投稿",
  "store.edit": "店舗情報の編集",
  "policy.edit": "AI返信方針の編集",
  "notifications.edit": "通知設定の編集",
  "members.manage": "担当者の招待・権限変更",
  "billing.view": "契約・請求の確認",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

export function can(role: Role, permission: Permission) {
  return MATRIX[role].includes(permission);
}

/** 担当店舗以外のデータには触れない */
export function canAccessStore(member: Pick<Member, "role" | "storeIds">, storeId: string) {
  return member.role === "owner" || member.storeIds.includes(storeId);
}

export function canOnStore(member: Pick<Member, "role" | "storeIds">, permission: Permission, storeId: string) {
  return canAccessStore(member, storeId) && can(member.role, permission);
}
