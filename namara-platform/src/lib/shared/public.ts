/**
 * 消費者向け API で返してよい形に変換する（内部用の項目を含めない）。
 */
import type { SearchOutcome, Store } from "./types";

export type PublicStore = Omit<Store, "organizationId" | "published">;

export function toPublicStore(store: Store): PublicStore {
  // 契約組織・公開フラグは消費者に返さない
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { organizationId, published, ...rest } = store;
  return rest;
}

export type PublicSearchOutcome = Omit<SearchOutcome, "results" | "sponsored"> & {
  results: (Omit<SearchOutcome["results"][number], "store"> & { store: PublicStore })[];
  sponsored: (Omit<NonNullable<SearchOutcome["sponsored"]>, "store" | "campaignId"> & { store: PublicStore }) | null;
};

export function toPublicOutcome(outcome: SearchOutcome): PublicSearchOutcome {
  return {
    ...outcome,
    results: outcome.results.map((r) => ({ ...r, store: toPublicStore(r.store) })),
    sponsored: outcome.sponsored
      ? {
          impressionId: outcome.sponsored.impressionId,
          budgetText: outcome.sponsored.budgetText,
          matchReasons: outcome.sponsored.matchReasons,
          store: toPublicStore(outcome.sponsored.store),
        }
      : null,
  };
}
