import "server-only";
import { db } from "./db";
import { DEFAULT_PROPOSAL_SETTINGS } from "./proposal";
import type { ProposalSettings } from "./types";

export async function proposalSettings(): Promise<ProposalSettings> {
  return { ...DEFAULT_PROPOSAL_SETTINGS, ...((await db.get("settings", "proposal")) ?? {}) };
}

export async function findProposalByToken(token: string) {
  if (!token) return null;
  return (await db.list("proposals")).find((p) => p.shareToken === token) ?? null;
}
