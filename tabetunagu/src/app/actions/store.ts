"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { isPlanCode } from "@/lib/fees";
import { quickRelistSchema } from "@/lib/quick-relist";
import { aiDescriptionSchema, fieldErrors, productFormSchema, storeSettingsSchema } from "@/lib/validation";
import { assertStoreMember, STORE_COOKIE } from "@/server/auth/viewer";
import { generateProductDescription } from "@/server/services/ai";
import { logEvent } from "@/server/services/events";
import {
  adjustProductQuantity,
  changeStorePlan,
  createProduct,
  deleteProduct,
  deleteTemplate,
  publishFromTemplate,
  rotateStoreQr,
  setProductStatus,
  setTemplateAutoRelist,
  storeCancelReservation,
  updateProductDetails,
  updateStoreSettings,
} from "@/server/services/store";
import { quickRelist } from "@/server/services/quick-relist";
import { saveProductImage } from "@/server/services/uploads";
import { toActionError, type ActionState } from "./state";

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** 店舗の切り替え（複数店舗のメンバーの場合） */
export async function selectStoreAction(formData: FormData) {
  const storeId = str(formData, "storeId");
  await assertStoreMember(storeId);
  (await cookies()).set(STORE_COOKIE, storeId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/store");
}

export async function createProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const storeId = str(formData, "storeId");
  let productId: string;
  try {
    const { viewer } = await assertStoreMember(storeId);
    const parsed = productFormSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, message: "入力内容をご確認ください。", fieldErrors: fieldErrors(parsed.error) };
    const form = parsed.data;
    const image = formData.get("image");
    if (image instanceof File && image.size > 0) {
      form.imageUrl = await saveProductImage(image, storeId);
    } else if (form.imageUrl && !/^(\/api\/uploads\/|https:\/\/)/.test(form.imageUrl)) {
      form.imageUrl = "";
    }
    productId = await createProduct(viewer.id, storeId, form);
    await logEvent("product_published", { userId: viewer.id, storeId, productId, properties: { source: form.templateId ? "template" : "form" } });
  } catch (error) {
    return toActionError(error);
  }
  redirect(`/store?published=${productId}`);
}

export async function publishTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const storeId = str(formData, "storeId");
  const templateId = str(formData, "templateId");
  try {
    const { viewer } = await assertStoreMember(storeId);
    const productId = await publishFromTemplate(viewer.id, storeId, templateId);
    await logEvent("product_published", { userId: viewer.id, storeId, productId, properties: { source: "one_tap" } });
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "出品しました。" };
}

export async function generateDescriptionAction(input: {
  storeId: string;
  name: string;
  isBox: boolean;
  category: string;
  rescuePrice: number;
  originalPrice: number | null;
  quantity: number;
  pickupEnd: string;
  keywords?: string;
}): Promise<{ ok: true; text: string; provider: string } | { ok: false; message: string }> {
  try {
    const { viewer, store } = await assertStoreMember(input.storeId);
    const parsed = aiDescriptionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "商品名・価格・数量・受取時間を入力してから生成してください。" };
    const result = await generateProductDescription(
      viewer.id,
      { id: store.storeId, name: store.storeName, category: parsed.data.category, plan: store.plan },
      parsed.data,
    );
    return { ok: true, text: result.text, provider: result.provider };
  } catch (error) {
    const e = toActionError(error);
    return { ok: false, message: e?.message ?? "生成できませんでした。" };
  }
}

export async function productStatusAction(formData: FormData) {
  const storeId = str(formData, "storeId");
  const { viewer } = await assertStoreMember(storeId);
  const status = str(formData, "status") === "published" ? "published" : "closed";
  await setProductStatus(viewer.id, storeId, str(formData, "productId"), status);
  refresh();
}

export async function updateProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const storeId = str(formData, "storeId");
  const productId = str(formData, "productId");
  try {
    const { viewer } = await assertStoreMember(storeId);
    const quantity = Number(formData.get("quantity"));
    const name = str(formData, "name").trim();
    const description = str(formData, "description").trim();
    const rescuePrice = Number(formData.get("rescuePrice"));
    const originalPrice = Number(formData.get("originalPrice"));
    if (!name || name.length > 60 || description.length > 600 || !Number.isInteger(rescuePrice) || !Number.isInteger(originalPrice) || rescuePrice < 1) {
      throw new AppError("validation");
    }
    await updateProductDetails(viewer.id, storeId, productId, { name, description, rescuePrice, originalPrice });
    if (Number.isInteger(quantity)) await adjustProductQuantity(viewer.id, productId, quantity);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "保存しました。" };
}

export async function deleteProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const storeId = str(formData, "storeId");
  try {
    const { viewer } = await assertStoreMember(storeId);
    await deleteProduct(viewer.id, str(formData, "productId"));
  } catch (error) {
    return toActionError(error);
  }
  redirect("/store/products");
}

export async function storeCancelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const storeId = str(formData, "storeId");
  try {
    const { viewer } = await assertStoreMember(storeId);
    await storeCancelReservation(viewer.id, str(formData, "reservationId"), str(formData, "reason").trim().slice(0, 200));
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "予約をキャンセルしました。" };
}

export async function updateStoreSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const storeId = str(formData, "storeId");
  try {
    const { viewer } = await assertStoreMember(storeId, { owner: true });
    const parsed = storeSettingsSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, message: "入力内容をご確認ください。", fieldErrors: fieldErrors(parsed.error) };
    await updateStoreSettings(viewer.id, storeId, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "店舗情報を保存しました。" };
}

export async function changePlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const storeId = str(formData, "storeId");
  const plan = str(formData, "plan");
  try {
    const { viewer } = await assertStoreMember(storeId, { owner: true });
    if (!isPlanCode(plan)) throw new AppError("invalid_plan");
    await changeStorePlan(viewer.id, storeId, plan);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "プランを変更しました。" };
}

export async function rotateQrAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const storeId = str(formData, "storeId");
  try {
    const { viewer } = await assertStoreMember(storeId, { owner: true });
    await rotateStoreQr(viewer.id, storeId);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "QRコードを再発行しました。古いQRは使えなくなりました。印刷し直してください。" };
}

export async function deleteTemplateAction(formData: FormData) {
  const storeId = str(formData, "storeId");
  const { viewer } = await assertStoreMember(storeId);
  await deleteTemplate(viewer.id, storeId, str(formData, "templateId"));
  refresh();
}

export async function autoRelistAction(formData: FormData) {
  const storeId = str(formData, "storeId");
  const { viewer, store } = await assertStoreMember(storeId);
  if (store.plan !== "standard") throw new AppError("forbidden", "自動再出品は STANDARD プランの機能です。");
  const weekdays = formData
    .getAll("weekdays")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  await setTemplateAutoRelist(viewer.id, storeId, str(formData, "templateId"), formData.get("enabled") === "on", weekdays);
  refresh();
}

/** かんたん出品: 過去の商品の内容 + 今回の数量・受取時間で、新しい商品として出品する（オーナー・スタッフ。自店舗の商品だけ） */
export async function quickRelistAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const storeId = str(formData, "storeId");
  try {
    const { viewer } = await assertStoreMember(storeId);
    const parsed = quickRelistSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, message: "入力内容をご確認ください。", fieldErrors: fieldErrors(parsed.error) };
    const productId = await quickRelist(viewer.id, storeId, parsed.data);
    await logEvent("product_published", { userId: viewer.id, storeId, productId, properties: { source: "quick_relist" } });
    refresh();
    return { ok: true, message: "出品しました！", data: { productId } };
  } catch (error) {
    return toActionError(error);
  }
}
