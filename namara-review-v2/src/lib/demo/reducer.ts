import { canOnStore } from "@/lib/permissions";
import type {
  AuditLog,
  Member,
  NotificationSettings,
  ReplyPolicy,
  Review,
  Role,
  Store,
  Tone,
} from "@/lib/types";
import type { SeedData } from "./seed";

export const STATE_VERSION = 1;

export interface DemoState extends SeedData {
  version: number;
  currentUserId: string;
  selectedStoreId: string | "all";
  /** 投稿を必ず失敗させる（エラー処理の確認用） */
  simulateFailure: boolean;
  syncCount: number;
}

export type DemoAction =
  | { type: "selectStore"; storeId: string | "all" }
  | { type: "switchUser"; userId: string }
  | { type: "saveDraft"; reviewId: string; text: string; tone: Tone; source: "ai" | "edited"; at: string }
  | { type: "discardDraft"; reviewId: string; at: string }
  | { type: "submitForApproval"; reviewId: string; at: string }
  | { type: "sendBack"; reviewId: string; at: string }
  | { type: "publishStarted"; reviewId: string; idempotencyKey: string; at: string }
  | { type: "publishFinished"; reviewId: string; idempotencyKey: string; ok: boolean; error: string | null; at: string }
  | { type: "updateStore"; storeId: string; patch: Partial<Pick<Store, "name" | "shortName" | "genre" | "area" | "address" | "phone" | "hours">>; at: string }
  | { type: "updatePolicy"; storeId: string; policy: ReplyPolicy; at: string }
  | { type: "updateNotifications"; storeId: string; notifications: NotificationSettings; at: string }
  | { type: "inviteMember"; member: Member; at: string }
  | { type: "updateMember"; memberId: string; role: Role; storeIds: string[]; at: string }
  | { type: "removeMember"; memberId: string; at: string }
  | { type: "setSimulateFailure"; value: boolean }
  | { type: "reviewsSynced"; reviews: Review[]; at: string };

export function currentMember(state: Pick<DemoState, "members" | "currentUserId">) {
  return state.members.find((m) => m.id === state.currentUserId) ?? state.members[0];
}

function log(state: DemoState, at: string, action: string, target: string): AuditLog[] {
  const actor = currentMember(state).name;
  return [{ id: `log_${at}_${state.auditLogs.length}`, at, actor, action, target }, ...state.auditLogs].slice(0, 200);
}

function storeLabel(state: DemoState, storeId: string) {
  return state.stores.find((s) => s.id === storeId)?.shortName ?? storeId;
}

function updateReview(state: DemoState, reviewId: string, patch: Partial<Review>) {
  return state.reviews.map((r) => (r.id === reviewId ? { ...r, ...patch } : r));
}

/**
 * 状態遷移はすべてここに集約し、権限と遷移条件をチェックする。
 * 条件を満たさない操作は「何もしない」（state をそのまま返す）。
 * Phase 2 以降はこのチェックをサーバー側（Route Handler + RLS）へ移す。
 */
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  const me = currentMember(state);
  const findReview = (id: string) => state.reviews.find((r) => r.id === id);

  switch (action.type) {
    case "selectStore": {
      if (action.storeId !== "all" && !canOnStore(me, "reply.edit", action.storeId)) return state;
      return { ...state, selectedStoreId: action.storeId };
    }
    case "switchUser": {
      const next = state.members.find((m) => m.id === action.userId);
      if (!next) return state;
      const selectedStoreId =
        state.selectedStoreId === "all" || next.role === "owner" || next.storeIds.includes(state.selectedStoreId)
          ? state.selectedStoreId
          : "all";
      return { ...state, currentUserId: next.id, selectedStoreId };
    }
    case "saveDraft": {
      const review = findReview(action.reviewId);
      if (!review || !canOnStore(me, "reply.edit", review.storeId)) return state;
      if (review.status === "published" || review.status === "publishing") return state;
      const existing = state.drafts[review.id];
      const text = action.text.slice(0, 4096);
      if (existing && existing.text === text && existing.tone === action.tone) return state;
      const draft = {
        id: existing?.id ?? `draft_${review.id}`,
        reviewId: review.id,
        text,
        tone: action.tone,
        source: action.source,
        version: (existing?.version ?? 0) + 1,
        updatedAt: action.at,
        updatedBy: action.source === "ai" ? "AI（NAMARA REVIEW）" : me.name,
        // 承認待ち中に内容が変わったら承認依頼をやり直す（承認内容と投稿内容のズレを防ぐ）
        submittedAt: null,
        submittedBy: null,
      };
      const status = review.status === "failed" ? "failed" : "draft";
      return {
        ...state,
        drafts: { ...state.drafts, [review.id]: draft },
        reviews: updateReview(state, review.id, { status }),
      };
    }
    case "discardDraft": {
      const review = findReview(action.reviewId);
      if (!review || !canOnStore(me, "reply.edit", review.storeId)) return state;
      if (review.status === "published" || review.status === "publishing") return state;
      const drafts = { ...state.drafts };
      delete drafts[review.id];
      return { ...state, drafts, reviews: updateReview(state, review.id, { status: "unreplied" }) };
    }
    case "submitForApproval": {
      const review = findReview(action.reviewId);
      const draft = state.drafts[action.reviewId];
      if (!review || !draft || !canOnStore(me, "reply.submit", review.storeId)) return state;
      if (review.status !== "draft") return state;
      return {
        ...state,
        drafts: { ...state.drafts, [review.id]: { ...draft, submittedAt: action.at, submittedBy: me.name } },
        reviews: updateReview(state, review.id, { status: "pending" }),
        auditLogs: log(state, action.at, "返信案を承認依頼", storeLabel(state, review.storeId)),
      };
    }
    case "sendBack": {
      const review = findReview(action.reviewId);
      const draft = state.drafts[action.reviewId];
      if (!review || !draft || !canOnStore(me, "reply.approve", review.storeId)) return state;
      if (review.status !== "pending") return state;
      return {
        ...state,
        drafts: { ...state.drafts, [review.id]: { ...draft, submittedAt: null, submittedBy: null } },
        reviews: updateReview(state, review.id, { status: "draft" }),
        auditLogs: log(state, action.at, "返信案を差し戻し", storeLabel(state, review.storeId)),
      };
    }
    case "publishStarted": {
      const review = findReview(action.reviewId);
      const draft = state.drafts[action.reviewId];
      if (!review || !draft || !canOnStore(me, "reply.approve", review.storeId)) return state;
      // 二重投稿防止: 投稿中・投稿済み・同じキーで成功済みなら開始しない
      if (review.status !== "pending" && review.status !== "draft" && review.status !== "failed") return state;
      if (action.idempotencyKey !== `${review.id}:${draft.version}`) return state;
      if (state.publications.some((p) => p.idempotencyKey === action.idempotencyKey && p.status === "success")) return state;
      return { ...state, reviews: updateReview(state, review.id, { status: "publishing" }) };
    }
    case "publishFinished": {
      const review = findReview(action.reviewId);
      const draft = state.drafts[action.reviewId];
      if (!review || !draft || review.status !== "publishing") return state;
      const attempt = state.publications.filter((p) => p.reviewId === review.id).length + 1;
      const publication = {
        id: `pub_${review.id}_${attempt}`,
        reviewId: review.id,
        draftId: draft.id,
        idempotencyKey: action.idempotencyKey,
        status: action.ok ? ("success" as const) : ("failed" as const),
        attempt,
        attemptedAt: action.at,
        actor: me.name,
        text: draft.text,
        error: action.error,
      };
      const label = storeLabel(state, review.storeId);
      if (!action.ok) {
        return {
          ...state,
          publications: [publication, ...state.publications],
          reviews: updateReview(state, review.id, { status: "failed" }),
          auditLogs: log(state, action.at, "返信の投稿に失敗", label),
        };
      }
      const drafts = { ...state.drafts };
      delete drafts[review.id];
      return {
        ...state,
        drafts,
        publications: [publication, ...state.publications],
        reviews: updateReview(state, review.id, {
          status: "published",
          publishedReply: { text: draft.text, publishedAt: action.at },
        }),
        auditLogs: log(state, action.at, "返信を承認してGoogleに投稿", label),
      };
    }
    case "updateStore": {
      if (!canOnStore(me, "store.edit", action.storeId)) return state;
      return {
        ...state,
        stores: state.stores.map((s) => (s.id === action.storeId ? { ...s, ...action.patch } : s)),
        auditLogs: log(state, action.at, "店舗情報を更新", storeLabel(state, action.storeId)),
      };
    }
    case "updatePolicy": {
      if (!canOnStore(me, "policy.edit", action.storeId)) return state;
      return {
        ...state,
        stores: state.stores.map((s) => (s.id === action.storeId ? { ...s, policy: action.policy } : s)),
        auditLogs: log(state, action.at, "AI返信方針を更新", storeLabel(state, action.storeId)),
      };
    }
    case "updateNotifications": {
      if (!canOnStore(me, "notifications.edit", action.storeId)) return state;
      return {
        ...state,
        stores: state.stores.map((s) => (s.id === action.storeId ? { ...s, notifications: action.notifications } : s)),
        auditLogs: log(state, action.at, "通知設定を更新", storeLabel(state, action.storeId)),
      };
    }
    case "inviteMember": {
      if (me.role !== "owner") return state;
      const email = action.member.email.trim().toLowerCase();
      if (state.members.some((m) => m.email.toLowerCase() === email)) return state;
      // オーナー権限は招待で付与しない（権限昇格防止。オーナー変更は運営経由）
      if (action.member.role === "owner") return state;
      return {
        ...state,
        members: [...state.members, { ...action.member, email }],
        auditLogs: log(state, action.at, `担当者を招待（${email}）`, "メンバー"),
      };
    }
    case "updateMember": {
      if (me.role !== "owner" || action.role === "owner") return state;
      const target = state.members.find((m) => m.id === action.memberId);
      if (!target || target.role === "owner") return state;
      return {
        ...state,
        members: state.members.map((m) =>
          m.id === action.memberId ? { ...m, role: action.role, storeIds: action.storeIds } : m,
        ),
        auditLogs: log(state, action.at, `${target.name}の権限を変更`, "メンバー"),
      };
    }
    case "removeMember": {
      const target = state.members.find((m) => m.id === action.memberId);
      if (me.role !== "owner" || !target || target.role === "owner") return state;
      return {
        ...state,
        members: state.members.filter((m) => m.id !== action.memberId),
        auditLogs: log(state, action.at, `${target.name}を削除`, "メンバー"),
      };
    }
    case "setSimulateFailure":
      return { ...state, simulateFailure: action.value };
    case "reviewsSynced": {
      // googleReviewId が既にあるものは取り込まない（重複取り込み防止）
      const known = new Set(state.reviews.map((r) => r.googleReviewId));
      const fresh = action.reviews.filter((r) => !known.has(r.googleReviewId));
      return {
        ...state,
        syncCount: state.syncCount + 1,
        reviews: [...fresh, ...state.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        stores: state.stores.map((s) => (s.googleStatus === "connected" ? { ...s, googleLastSyncedAt: action.at } : s)),
        auditLogs: [
          { id: `log_sync_${action.at}`, at: action.at, actor: "システム", action: `Google口コミを同期（新着${fresh.length}件）`, target: "全店舗" },
          ...state.auditLogs,
        ],
      };
    }
    default:
      return state;
  }
}
