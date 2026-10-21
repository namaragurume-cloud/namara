import { STATE_VERSION, type DemoState } from "@/lib/demo/reducer";
import { createSeedData } from "@/lib/demo/seed";

export function createState(overrides: Partial<DemoState> = {}): DemoState {
  return {
    ...structuredClone(createSeedData()),
    version: STATE_VERSION,
    currentUserId: "user_owner",
    selectedStoreId: "all",
    simulateFailure: false,
    syncCount: 0,
    ...overrides,
  };
}

export const AT = "2026-10-21T18:30:00+09:00";
