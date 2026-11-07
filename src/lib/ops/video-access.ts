import "server-only";
import { accessAssignment } from "./access";
import { videoEnabled, videoStage } from "./video-state";

/** 動画を送ってよいか（管理者か本人、動画チェックありの案件、まだOKになっていない） */
export async function canUploadVideo(assignmentId: string, token: string | null | undefined) {
  const access = await accessAssignment(assignmentId, token);
  if (!access) return { error: "このページからは送れません" } as const;
  const { a, campaign } = access;
  if (!videoEnabled(campaign)) return { error: "この案件は動画チェックがありません" } as const;
  if (a.status !== "accepted" || !a.confirmedSlotId) return { error: "撮影日の確定後に送れます" } as const;
  if (campaign.reportSentAt) return { error: "この案件は終了しています" } as const;
  if (videoStage(a, campaign) === "approved" && access.as === "creator") return { error: "動画はすでにOKになっています" } as const;
  return { access } as const;
}
