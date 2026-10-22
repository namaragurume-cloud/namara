"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/lib/server/authz";
import { getCurrentActor } from "@/lib/server/demo-session";
import { createCampaign, reviewCampaign, stopCampaignByStore } from "@/lib/server/services/ad-service";

export type CampaignFormState = { ok: boolean; message: string; errors: Record<string, string> };

export async function createCampaignAction(_prev: CampaignFormState, formData: FormData): Promise<CampaignFormState> {
  const actor = await getCurrentActor();
  const raw = {
    storeId: formData.get("storeId"),
    name: formData.get("name"),
    areaIds: formData.getAll("areaIds"),
    genreIds: formData.getAll("genreIds"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    budgetYen: formData.get("budgetYen"),
  };
  try {
    createCampaign(actor, raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
      return { ok: false, message: "入力内容を確認してください。", errors };
    }
    if (error instanceof ForbiddenError) return { ok: false, message: error.message, errors: {} };
    throw error;
  }
  revalidatePath("/review/ads");
  return { ok: true, message: "キャンペーンを作成しました。運営の審査後に配信されます（決済は発生しません）。", errors: {} };
}

export async function stopCampaignAction(formData: FormData) {
  const actor = await getCurrentActor();
  stopCampaignByStore(actor, String(formData.get("campaignId") ?? ""));
  revalidatePath("/review/ads");
}

const reviewSchema = z.object({
  campaignId: z.string().min(1),
  decision: z.enum(["approve", "reject", "stop"]),
  note: z.string().max(200).default(""),
});

export async function reviewCampaignAction(formData: FormData) {
  const actor = await getCurrentActor();
  const input = reviewSchema.parse({ campaignId: formData.get("campaignId"), decision: formData.get("decision"), note: formData.get("note") ?? "" });
  reviewCampaign(actor, input.campaignId, input.decision, input.note);
  revalidatePath("/admin/ads");
}
