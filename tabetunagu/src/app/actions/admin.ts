"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AREA_IDS, CATEGORY_IDS } from "@/lib/categories";
import { AppError } from "@/lib/errors";
import { assertAdmin } from "@/server/auth/viewer";
import { env } from "@/server/env";
import {
  adminAddMember,
  adminCreateStore,
  adminRemoveMember,
  adminUpdateStore,
  generateBilling,
  refreshDemoData,
  runAutoRelist,
  runSweep,
} from "@/server/services/admin";
import { sendEveningDigest } from "@/server/services/notifications";
import { toActionError, type ActionState } from "./state";

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "");
const uuid = z.string().uuid();

export async function sweepAction(): Promise<ActionState> {
  try {
    await assertAdmin();
    const r = await runSweep();
    refresh();
    return { ok: true, message: `No Show ${r.no_show}件・期限切れ ${r.expired}件・受付終了 ${r.closed_products}件を処理しました。` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function autoRelistAdminAction(): Promise<ActionState> {
  try {
    await assertAdmin();
    const n = await runAutoRelist();
    refresh();
    return { ok: true, message: `${n}件を自動再出品しました。` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function refreshDemoAction(): Promise<ActionState> {
  try {
    await assertAdmin();
    if (!env.demoLoginEnabled) throw new AppError("forbidden");
    await refreshDemoData();
    refresh();
    return { ok: true, message: "デモの出品を今日の日付で作り直しました。" };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateStoreAdminAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const storeId = uuid.parse(str(formData, "storeId"));
    await adminUpdateStore(storeId, { status: str(formData, "status") || undefined, plan: str(formData, "plan") || undefined });
    refresh();
    return { ok: true, message: "更新しました。" };
  } catch (error) {
    return toActionError(error);
  }
}

export async function addMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const storeId = uuid.parse(str(formData, "storeId"));
    const userId = z.string().trim().uuid("ユーザーIDの形式が正しくありません。").safeParse(str(formData, "userId"));
    if (!userId.success) throw new AppError("validation", userId.error.issues[0].message);
    await adminAddMember(storeId, userId.data, str(formData, "role") === "owner" ? "owner" : "staff");
    refresh();
    return { ok: true, message: "メンバーを追加しました。" };
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeMemberAction(formData: FormData) {
  await assertAdmin();
  await adminRemoveMember(uuid.parse(str(formData, "storeId")), uuid.parse(str(formData, "userId")));
  refresh();
}

const createStoreSchema = z.object({
  name: z.string().trim().min(1, "店舗名を入力してください").max(80),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,64}$/, "URL名は半角英小文字・数字・ハイフンで入力してください"),
  areaId: z.enum(AREA_IDS),
  category: z.enum(CATEGORY_IDS),
});

export async function createStoreAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    await assertAdmin();
    const parsed = createStoreSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) throw new AppError("validation", parsed.error.issues[0].message);
    id = await adminCreateStore(parsed.data);
  } catch (error) {
    const e = toActionError(error);
    if (String((error as Error)?.message).includes("stores_slug_key")) return { ok: false, message: "このURL名はすでに使われています。" };
    return e;
  }
  redirect(`/admin/stores/${id}`);
}

export async function sendDigestAction(): Promise<ActionState> {
  try {
    const viewer = await assertAdmin();
    const r = await sendEveningDigest(viewer.id);
    refresh();
    return {
      ok: true,
      message: `LINE へは送らず、対象 ${r.targets}人分を記録しました（記録のみ）。`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function generateBillingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const month = str(formData, "month");
    if (!/^\d{4}-\d{2}$/.test(month)) throw new AppError("validation");
    const n = await generateBilling(month);
    refresh();
    return { ok: true, message: `${month} の請求データを ${n} 店舗分作成しました（確定済みのものは変更しません）。` };
  } catch (error) {
    return toActionError(error);
  }
}
