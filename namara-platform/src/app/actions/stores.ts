"use server";

import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/lib/server/demo-session";
import { markStoreVerified, setStorePublished } from "@/lib/server/services/store-service";

export async function togglePublishAction(formData: FormData) {
  const actor = await getCurrentActor();
  setStorePublished(actor, String(formData.get("storeId") ?? ""), formData.get("publish") === "1");
  revalidatePath("/admin/stores");
}

export async function verifyStoreAction(formData: FormData) {
  const actor = await getCurrentActor();
  markStoreVerified(actor, String(formData.get("storeId") ?? ""));
  revalidatePath("/admin/stores");
}
