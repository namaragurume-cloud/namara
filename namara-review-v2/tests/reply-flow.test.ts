import { describe, expect, it } from "vitest";

import { demoReducer, type DemoState } from "@/lib/demo/reducer";
import { AT, createState } from "./helpers";

function firstReview(state: DemoState, status: string, storeId?: string) {
  const review = state.reviews.find((r) => r.status === status && (!storeId || r.storeId === storeId));
  if (!review) throw new Error(`no ${status} review`);
  return review;
}

function draftAndPublish(state: DemoState, reviewId: string, ok = true) {
  let s = demoReducer(state, { type: "saveDraft", reviewId, text: "ご来店ありがとうございました。", tone: "friendly", source: "edited", at: AT });
  const key = `${reviewId}:${s.drafts[reviewId].version}`;
  s = demoReducer(s, { type: "publishStarted", reviewId, idempotencyKey: key, at: AT });
  s = demoReducer(s, { type: "publishFinished", reviewId, idempotencyKey: key, ok, error: ok ? null : "error", at: AT });
  return { state: s, key };
}

describe("返信の承認フロー", () => {
  it("下書き→承認依頼→承認・投稿で返信済みになる", () => {
    let s = createState({ currentUserId: "user_staff" });
    const review = firstReview(s, "unreplied", "store_cafe");
    s = demoReducer(s, { type: "saveDraft", reviewId: review.id, text: "ありがとうございます", tone: "casual", source: "ai", at: AT });
    expect(s.reviews.find((r) => r.id === review.id)?.status).toBe("draft");
    s = demoReducer(s, { type: "submitForApproval", reviewId: review.id, at: AT });
    expect(s.reviews.find((r) => r.id === review.id)?.status).toBe("pending");

    s = demoReducer(s, { type: "switchUser", userId: "user_owner" });
    const key = `${review.id}:${s.drafts[review.id].version}`;
    s = demoReducer(s, { type: "publishStarted", reviewId: review.id, idempotencyKey: key, at: AT });
    expect(s.reviews.find((r) => r.id === review.id)?.status).toBe("publishing");
    s = demoReducer(s, { type: "publishFinished", reviewId: review.id, idempotencyKey: key, ok: true, error: null, at: AT });
    const done = s.reviews.find((r) => r.id === review.id);
    expect(done?.status).toBe("published");
    expect(done?.publishedReply?.text).toBe("ありがとうございます");
    expect(s.drafts[review.id]).toBeUndefined();
  });

  it("投稿済みの口コミは同じキーでも別のキーでも再投稿できない（二重投稿防止）", () => {
    const base = createState();
    const review = firstReview(base, "unreplied");
    const { state, key } = draftAndPublish(base, review.id);
    const again = demoReducer(state, { type: "publishStarted", reviewId: review.id, idempotencyKey: key, at: AT });
    expect(again).toBe(state);
    expect(state.publications.filter((p) => p.reviewId === review.id && p.status === "success")).toHaveLength(1);
  });

  it("投稿中に2回目の開始要求が来ても無視する", () => {
    let s = createState();
    const review = firstReview(s, "unreplied");
    s = demoReducer(s, { type: "saveDraft", reviewId: review.id, text: "テスト", tone: "polite", source: "edited", at: AT });
    const key = `${review.id}:1`;
    s = demoReducer(s, { type: "publishStarted", reviewId: review.id, idempotencyKey: key, at: AT });
    const second = demoReducer(s, { type: "publishStarted", reviewId: review.id, idempotencyKey: key, at: AT });
    expect(second).toBe(s);
  });

  it("古い版のキーでは投稿を開始できない（承認内容と投稿内容のズレ防止）", () => {
    let s = createState();
    const review = firstReview(s, "unreplied");
    s = demoReducer(s, { type: "saveDraft", reviewId: review.id, text: "v1", tone: "polite", source: "edited", at: AT });
    s = demoReducer(s, { type: "saveDraft", reviewId: review.id, text: "v2", tone: "polite", source: "edited", at: AT });
    const stale = demoReducer(s, { type: "publishStarted", reviewId: review.id, idempotencyKey: `${review.id}:1`, at: AT });
    expect(stale).toBe(s);
  });

  it("失敗したら failed になり、再試行で成功できる", () => {
    const base = createState();
    const review = firstReview(base, "unreplied");
    const failed = draftAndPublish(base, review.id, false).state;
    expect(failed.reviews.find((r) => r.id === review.id)?.status).toBe("failed");
    const key = `${review.id}:${failed.drafts[review.id].version}`;
    let s = demoReducer(failed, { type: "publishStarted", reviewId: review.id, idempotencyKey: key, at: AT });
    s = demoReducer(s, { type: "publishFinished", reviewId: review.id, idempotencyKey: key, ok: true, error: null, at: AT });
    expect(s.reviews.find((r) => r.id === review.id)?.status).toBe("published");
    expect(s.publications.filter((p) => p.reviewId === review.id).map((p) => p.attempt)).toEqual([2, 1]);
  });

  it("承認待ち中に編集すると承認依頼が取り消される", () => {
    const s = createState();
    const review = firstReview(s, "pending", "store_yakiniku");
    const edited = demoReducer(s, { type: "saveDraft", reviewId: review.id, text: "編集後", tone: "friendly", source: "edited", at: AT });
    expect(edited.reviews.find((r) => r.id === review.id)?.status).toBe("draft");
    expect(edited.drafts[review.id].submittedAt).toBeNull();
  });
});

describe("権限", () => {
  it("スタッフは承認・投稿できない", () => {
    let s = createState({ currentUserId: "user_staff" });
    const review = firstReview(s, "unreplied", "store_cafe");
    s = demoReducer(s, { type: "saveDraft", reviewId: review.id, text: "テスト", tone: "casual", source: "edited", at: AT });
    const attempt = demoReducer(s, { type: "publishStarted", reviewId: review.id, idempotencyKey: `${review.id}:1`, at: AT });
    expect(attempt).toBe(s);
  });

  it("担当外の店舗の口コミは編集できない", () => {
    const s = createState({ currentUserId: "user_staff" });
    const other = firstReview(s, "unreplied", "store_yakiniku");
    const attempt = demoReducer(s, { type: "saveDraft", reviewId: other.id, text: "x", tone: "polite", source: "edited", at: AT });
    expect(attempt).toBe(s);
    expect(demoReducer(s, { type: "selectStore", storeId: "store_yakiniku" })).toBe(s);
  });

  it("店長は担当外の店舗の設定を変更できない", () => {
    const s = createState({ currentUserId: "user_manager" });
    const store = s.stores.find((x) => x.id === "store_cafe")!;
    const attempt = demoReducer(s, { type: "updatePolicy", storeId: store.id, policy: { ...store.policy, signature: "x" }, at: AT });
    expect(attempt).toBe(s);
  });

  it("招待や権限変更でオーナー権限は付与できない（権限昇格防止）", () => {
    const s = createState();
    const invite = demoReducer(s, {
      type: "inviteMember",
      member: { id: "u_x", name: "X", email: "x@example.com", role: "owner", storeIds: [], lineLinked: false, lastActiveAt: AT },
      at: AT,
    });
    expect(invite).toBe(s);
    const promote = demoReducer(s, { type: "updateMember", memberId: "user_staff", role: "owner", storeIds: [], at: AT });
    expect(promote).toBe(s);
  });

  it("オーナー以外は担当者を招待できない", () => {
    const s = createState({ currentUserId: "user_manager" });
    const invite = demoReducer(s, {
      type: "inviteMember",
      member: { id: "u_y", name: "Y", email: "y@example.com", role: "staff", storeIds: ["store_yakiniku"], lineLinked: false, lastActiveAt: AT },
      at: AT,
    });
    expect(invite).toBe(s);
  });

  it("同じメールアドレスは重複して招待できない", () => {
    const s = createState();
    const invite = demoReducer(s, {
      type: "inviteMember",
      member: { id: "u_z", name: "Z", email: "OWNER@example.com", role: "staff", storeIds: ["store_cafe"], lineLinked: false, lastActiveAt: AT },
      at: AT,
    });
    expect(invite).toBe(s);
  });
});

describe("口コミ同期", () => {
  it("同じGoogle口コミIDは二重に取り込まない", () => {
    const s = createState();
    const existing = s.reviews[0];
    const synced = demoReducer(s, { type: "reviewsSynced", reviews: [{ ...existing, id: "dup" }], at: AT });
    expect(synced.reviews).toHaveLength(s.reviews.length);
  });
});
