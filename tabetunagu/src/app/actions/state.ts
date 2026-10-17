import "server-only";
import { AppError } from "@/lib/errors";

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** 任意の追加情報（QRチェックインの結果コードなど） */
  code?: string;
  data?: Record<string, unknown>;
} | null;

/** Server Action のエラーをユーザー向けの文言に変換する（内部エラーの詳細は返さない） */
export function toActionError(error: unknown): ActionState {
  if (error instanceof AppError) return { ok: false, message: error.message, code: error.code };
  console.error("[action] unexpected error", error);
  return { ok: false, message: "エラーが発生しました。時間をおいてもう一度お試しください。", code: "unknown" };
}
