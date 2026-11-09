import type { Phase } from "@/lib/ops/service";
import type { Tone } from "./ui";

export const phaseTone: Record<Phase, Tone> = {
  draft: "gray",
  recruiting: "blue",
  confirming: "amber",
  scheduled: "blue",
  insight: "blue",
  report: "amber",
  done: "green",
};

export const statusLabel = {
  unsent: "未送信",
  sent: "回答待ち",
  accepted: "参加",
  declined: "見送り",
} as const;

export const statusTone = {
  unsent: "red",
  sent: "gray",
  accepted: "green",
  declined: "gray",
} as const satisfies Record<keyof typeof statusLabel, Tone>;

export const channelLabel = { line: "LINE", email: "メール", manual: "手動" } as const;
