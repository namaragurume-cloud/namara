/**
 * 店舗マスターの更新（運営のみ）。変更は監査ログに残す。
 */
import "server-only";
import type { Store } from "@/lib/shared/types";
import { addAuditLog, getDb, type Db } from "../db";
import { actorId, assertOperator, ForbiddenError, type Actor } from "../authz";

export function getPublicStore(storeId: string, db: Db = getDb()): Store | null {
  const store = db.stores.find((s) => s.id === storeId);
  return store && store.published && store.verification.status === "verified" ? store : null;
}

export function setStorePublished(actor: Actor, storeId: string, published: boolean, db: Db = getDb(), now: Date = new Date()): Store {
  assertOperator(actor);
  const store = db.stores.find((s) => s.id === storeId);
  if (!store) throw new ForbiddenError("店舗が見つかりません");
  if (published && store.verification.status !== "verified") throw new ForbiddenError("未検証の店舗は公開できません");
  store.published = published;
  store.updatedAt = now.toISOString().slice(0, 10);
  addAuditLog(db, { actorId: actorId(actor), action: published ? "store.publish" : "store.unpublish", targetType: "store", targetId: store.id, detail: "" });
  return store;
}

export function markStoreVerified(actor: Actor, storeId: string, db: Db = getDb(), now: Date = new Date()): Store {
  assertOperator(actor);
  const store = db.stores.find((s) => s.id === storeId);
  if (!store) throw new ForbiddenError("店舗が見つかりません");
  store.verification = { ...store.verification, status: "verified", verifiedAt: now.toISOString().slice(0, 10) };
  store.updatedAt = now.toISOString().slice(0, 10);
  addAuditLog(db, { actorId: actorId(actor), action: "store.verify", targetType: "store", targetId: store.id, detail: "情報確認日を更新" });
  return store;
}
