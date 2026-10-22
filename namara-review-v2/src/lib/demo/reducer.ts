import { PLANS } from "@/lib/constants";
import { validateSlug } from "@/lib/organizations";
import { canOnStore } from "@/lib/permissions";
import type {
  AuditLog,
  Member,
  Organization,
  NotificationSettings,
  ReplyPolicy,
  Review,
  Role,
  Store,
  Tone,
} from "@/lib/types";
import type { SeedData } from "./seed";

// 構造を変えたら上げる（古い保存データは読み込まずにサンプルデータで起動し直す）
export const STATE_VERSION = 2;

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
  /** 運営（なまらグルメ）が新しい法人の専用ページを発行する */
  | { type: "createOrganization"; organization: Organization; owner: Member; at: string }
  /** オーナーが店舗を追加する（プランの店舗数まで） */
  | { type: "addStore"; store: Store; at: string }
  | { type: "reviewsSynced"; reviews: Review[]; at: string };

export function currentMember(state: Pick<DemoState, "members" | "currentUserId">) {
  return state.members.find((m) => m.id === state.currentUserId) ?? state.members[0];
}

export function currentOrganization(state: Pick<DemoState, "members" | "currentUserId" | "organizations">) {
  const me = currentMember(state);
  return state.organizations.find((o) => o.id === me.organizationId) ?? state.organizations[0];
}

function log(state: DemoState, at: string, action: string, target: string): AuditLog[] {
  const me = currentMember(state);
  return [
    { id: `log_${at}_${state.auditLogs.length}`, organizationId: me.organizationId, at, actor: me.name, action, target },
    ...state.auditLogs,
  ].slice(0, 500);
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
  const storeOf = (id: string) => state.stores.find((s) => s.id === id);
  /** 自分の法人の店舗IDだけで構成されているか（他法人の店舗の割り当てを防ぐ） */
  const ownStoreIds = (ids: string[]) =>
    ids.length > 0 && ids.every((id) => storeOf(id)?.organizationId === me.organizationId);

  switch (action.type) {
    case "selectStore": {
      if (action.storeId !== "all" && !canOnStore(me, "reply.edit", storeOf(action.storeId))) return state;
      return { ...state, selectedStoreId: action.storeId };
    }
    case "switchUser": {
      const next = state.members.find((m) => m.id === action.userId);
      if (!next) return state;
      // 別の法人・担当外の店舗が選ばれたままにならないようにする
      const selectedStoreId =
        state.selectedStoreId !== "all" && canOnStore(next, "reply.edit", storeOf(state.selectedStoreId))
          ? state.selectedStoreId
          : "all";
      return { ...state, currentUserId: next.id, selectedStoreId };
    }
    case "saveDraft": {
      const review = findReview(action.reviewId);
      if (!review || !canOnStore(me, "reply.edit", storeOf(review.storeId))) return state;
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
      if (!review || !canOnStore(me, "reply.edit", storeOf(review.storeId))) return state;
      if (review.status === "published" || review.status === "publishing") return state;
      const drafts = { ...state.drafts };
      delete drafts[review.id];
      return { ...state, drafts, reviews: updateReview(state, review.id, { status: "unreplied" }) };
    }
    case "submitForApproval": {
      const review = findReview(action.reviewId);
      const draft = state.drafts[action.reviewId];
      if (!review || !draft || !canOnStore(me, "reply.submit", storeOf(review.storeId))) return state;
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
      if (!review || !draft || !canOnStore(me, "reply.approve", storeOf(review.storeId))) return state;
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
      if (!review || !draft || !canOnStore(me, "reply.approve", storeOf(review.storeId))) return state;
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
      if (!canOnStore(me, "store.edit", storeOf(action.storeId))) return state;
      return {
        ...state,
        stores: state.stores.map((s) => (s.id === action.storeId ? { ...s, ...action.patch } : s)),
        auditLogs: log(state, action.at, "店舗情報を更新", storeLabel(state, action.storeId)),
      };
    }
    case "updatePolicy": {
      if (!canOnStore(me, "policy.edit", storeOf(action.storeId))) return state;
      return {
        ...state,
        stores: state.stores.map((s) => (s.id === action.storeId ? { ...s, policy: action.policy } : s)),
        auditLogs: log(state, action.at, "AI返信方針を更新", storeLabel(state, action.storeId)),
      };
    }
    case "updateNotifications": {
      if (!canOnStore(me, "notifications.edit", storeOf(action.storeId))) return state;
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
      if (!ownStoreIds(action.member.storeIds)) return state;
      return {
        ...state,
        // 招待先の法人は常に招待した人の法人（他法人へのメンバー追加を防ぐ）
        members: [...state.members, { ...action.member, email, organizationId: me.organizationId }],
        auditLogs: log(state, action.at, `担当者を招待（${email}）`, "メンバー"),
      };
    }
    case "updateMember": {
      if (me.role !== "owner" || action.role === "owner") return state;
      const target = state.members.find((m) => m.id === action.memberId);
      if (!target || target.role === "owner" || target.organizationId !== me.organizationId) return state;
      if (!ownStoreIds(action.storeIds)) return state;
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
      if (me.role !== "owner" || !target || target.role === "owner" || target.organizationId !== me.organizationId) return state;
      return {
        ...state,
        members: state.members.filter((m) => m.id !== action.memberId),
        auditLogs: log(state, action.at, `${target.name}を削除`, "メンバー"),
      };
    }
    case "setSimulateFailure":
      return { ...state, simulateFailure: action.value };
    case "createOrganization": {
      // Phase 2 では運営権限（platform_admins）を持つ人だけがサーバー側で実行できる
      const { organization, owner } = action;
      if (validateSlug(organization.slug, state.organizations.map((o) => o.slug))) return state;
      if (!organization.name.trim() || state.organizations.some((o) => o.id === organization.id)) return state;
      const email = owner.email.trim().toLowerCase();
      if (!email || state.members.some((m) => m.email.toLowerCase() === email)) return state;
      return {
        ...state,
        organizations: [...state.organizations, organization],
        members: [
          ...state.members,
          { ...owner, email, role: "owner", organizationId: organization.id, storeIds: [], invited: false },
        ],
        auditLogs: [
          { id: `log_org_${organization.id}`, organizationId: organization.id, at: action.at, actor: "なまらグルメ運営", action: "専用ページを発行", target: organization.name },
          ...state.auditLogs,
        ],
      };
    }
    case "addStore": {
      const organization = state.organizations.find((o) => o.id === me.organizationId);
      if (me.role !== "owner" || !organization || action.store.organizationId !== organization.id) return state;
      if (!action.store.name.trim() || state.stores.some((s) => s.id === action.store.id)) return state;
      const count = state.stores.filter((s) => s.organizationId === organization.id).length;
      if (count >= PLANS[organization.plan].stores) return state;
      return {
        ...state,
        stores: [...state.stores, action.store],
        // オーナーは自法人の全店舗を担当する
        members: state.members.map((m) =>
          m.organizationId === organization.id && m.role === "owner" ? { ...m, storeIds: [...m.storeIds, action.store.id] } : m,
        ),
        auditLogs: log(state, action.at, "店舗を追加", action.store.name),
      };
    }
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
          ...state.organizations.map((org) => ({
            id: `log_sync_${action.at}_${org.id}`,
            organizationId: org.id,
            at: action.at,
            actor: "システム",
            action: `Google口コミを同期（新着${fresh.filter((r) => storeOf(r.storeId)?.organizationId === org.id).length}件）`,
            target: "全店舗",
          })),
          ...state.auditLogs,
        ].slice(0, 500),
      };
    }
    default:
      return state;
  }
}
