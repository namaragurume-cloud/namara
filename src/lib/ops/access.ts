import "server-only";
import { isAdmin } from "./auth";
import { db } from "./db";
import { findCreatorByToken } from "./service";
import type { Assignment, Campaign } from "./types";

/** 管理者、またはその依頼の発信者本人（専用URLのトークン）だけが操作できる */
export async function accessAssignment(
  assignmentId: string,
  token: string | null | undefined,
): Promise<{ a: Assignment; campaign: Campaign; as: "admin" | "creator" } | null> {
  const a = assignmentId ? await db.get("assignments", assignmentId) : null;
  if (!a) return null;
  const campaign = await db.get("campaigns", a.campaignId);
  if (!campaign) return null;
  if (token) {
    const creator = await findCreatorByToken(token);
    if (creator && creator.id === a.creatorId) return { a, campaign, as: "creator" };
    return null;
  }
  return (await isAdmin()) ? { a, campaign, as: "admin" } : null;
}
