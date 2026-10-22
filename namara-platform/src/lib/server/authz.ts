/**
 * サーバー側の認可（誰が何を見られるか）。
 *
 * 画面の表示制御だけに頼らず、データを返すサービス関数の入口で必ずチェックする。
 * 本番では Supabase Auth のユーザーと organization_members / store_members を元に Actor を作り、
 * さらにデータベース側の RLS でも同じルールを強制する（二重の防御）。
 */
export type Actor =
  | { kind: "anonymous" }
  | { kind: "store_member"; userId: string; organizationId: string; storeIds: string[]; role: "owner" | "staff" }
  | { kind: "operator"; userId: string };

export class ForbiddenError extends Error {
  constructor(message = "この操作を行う権限がありません") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function isOperator(actor: Actor): actor is Extract<Actor, { kind: "operator" }> {
  return actor.kind === "operator";
}

export function assertOperator(actor: Actor): asserts actor is Extract<Actor, { kind: "operator" }> {
  if (!isOperator(actor)) throw new ForbiddenError("運営者のみ利用できます");
}

export function canAccessStore(actor: Actor, storeId: string): boolean {
  if (actor.kind === "operator") return true;
  if (actor.kind === "store_member") return actor.storeIds.includes(storeId);
  return false;
}

export function assertStoreAccess(actor: Actor, storeId: string): void {
  if (!canAccessStore(actor, storeId)) throw new ForbiddenError("この店舗のデータを見る権限がありません");
}

/** 店舗の設定変更（広告作成・停止など）はオーナーのみ。スタッフは閲覧のみ */
export function assertStoreManager(actor: Actor, storeId: string): void {
  assertStoreAccess(actor, storeId);
  if (actor.kind === "store_member" && actor.role !== "owner") throw new ForbiddenError("店舗オーナーのみ変更できます");
}

export function actorId(actor: Actor): string {
  return actor.kind === "anonymous" ? "anonymous" : actor.userId;
}
