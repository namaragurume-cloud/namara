import "server-only";
import { db } from "./db";
import { buildReachModel, estimateReach, type ReachEstimate } from "./reach";

/** 全発信者の予想リーチ（このツールのインサイト実績から推計） */
export async function reachEstimates(): Promise<Map<string, ReachEstimate>> {
  const [assignments, creators] = await Promise.all([db.list("assignments"), db.list("creators")]);
  const model = buildReachModel(assignments, creators);
  const out = new Map<string, ReachEstimate>();
  for (const c of creators) {
    const e = estimateReach(c, model);
    if (e) out.set(c.id, e);
  }
  return out;
}
