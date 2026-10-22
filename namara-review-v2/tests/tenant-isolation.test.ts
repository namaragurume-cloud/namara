import { describe, expect, it } from "vitest";

import { demoReducer } from "@/lib/demo/reducer";
import type { Member, Store } from "@/lib/types";
import { AT, createState } from "./helpers";

const NAMARA_STORE = "store_yakiniku";
const HOKKAI_STORE = "store_hokkai_odori";

function member(overrides: Partial<Member>): Member {
  return {
    id: "u_new",
    organizationId: "org_hokkai",
    name: "新人",
    email: "new@example.com",
    role: "staff",
    storeIds: [HOKKAI_STORE],
    lineLinked: false,
    lastActiveAt: AT,
    ...overrides,
  };
}

function store(overrides: Partial<Store>): Store {
  const base = createState().stores.find((s) => s.id === "store_homura")!;
  return { ...base, id: "store_new", name: "2号店", ...overrides };
}

describe("法人（テナント）の分離", () => {
  it("サンプルデータの店舗・メンバーはすべて実在する法人に属する", () => {
    const s = createState();
    const orgIds = new Set(s.organizations.map((o) => o.id));
    expect(s.organizations.length).toBeGreaterThanOrEqual(3);
    expect(s.stores.every((x) => orgIds.has(x.organizationId))).toBe(true);
    expect(s.members.every((x) => orgIds.has(x.organizationId))).toBe(true);
    // メンバーの担当店舗は必ず自分の法人の店舗
    for (const m of s.members) {
      for (const id of m.storeIds) expect(s.stores.find((x) => x.id === id)?.organizationId).toBe(m.organizationId);
    }
  });

  it("他の法人の店舗は選択・返信・設定変更ができない", () => {
    const s = createState({ currentUserId: "user_hokkai_owner" });
    const foreignReview = s.reviews.find((r) => r.storeId === NAMARA_STORE && r.status === "unreplied")!;
    const foreignStore = s.stores.find((x) => x.id === NAMARA_STORE)!;
    expect(demoReducer(s, { type: "selectStore", storeId: NAMARA_STORE })).toBe(s);
    expect(
      demoReducer(s, { type: "saveDraft", reviewId: foreignReview.id, text: "x", tone: "polite", source: "edited", at: AT }),
    ).toBe(s);
    expect(
      demoReducer(s, { type: "updatePolicy", storeId: NAMARA_STORE, policy: { ...foreignStore.policy, signature: "乗っ取り" }, at: AT }),
    ).toBe(s);
    expect(demoReducer(s, { type: "updateStore", storeId: NAMARA_STORE, patch: { name: "x" }, at: AT })).toBe(s);
  });

  it("他の法人のメンバーは変更・削除できない", () => {
    const s = createState({ currentUserId: "user_hokkai_owner" });
    expect(demoReducer(s, { type: "updateMember", memberId: "user_staff", role: "manager", storeIds: [HOKKAI_STORE], at: AT })).toBe(s);
    expect(demoReducer(s, { type: "removeMember", memberId: "user_staff", at: AT })).toBe(s);
  });

  it("招待したメンバーは必ず招待した人の法人に入り、他法人の店舗は割り当てられない", () => {
    const s = createState({ currentUserId: "user_hokkai_owner" });
    const sneaky = demoReducer(s, { type: "inviteMember", member: member({ organizationId: "org_namara" }), at: AT });
    expect(sneaky.members.find((m) => m.id === "u_new")?.organizationId).toBe("org_hokkai");
    const foreignStore = demoReducer(s, { type: "inviteMember", member: member({ storeIds: [NAMARA_STORE] }), at: AT });
    expect(foreignStore).toBe(s);
  });

  it("別の法人のユーザーに切り替えると、前の法人の店舗選択は解除される", () => {
    let s = createState();
    s = demoReducer(s, { type: "selectStore", storeId: NAMARA_STORE });
    s = demoReducer(s, { type: "switchUser", userId: "user_hokkai_owner" });
    expect(s.selectedStoreId).toBe("all");
  });

  it("操作履歴は操作した人の法人に記録される", () => {
    const s = createState({ currentUserId: "user_hokkai_owner" });
    const next = demoReducer(s, { type: "updateStore", storeId: HOKKAI_STORE, patch: { phone: "011-111-1111" }, at: AT });
    expect(next.auditLogs[0].organizationId).toBe("org_hokkai");
  });
});

describe("法人の専用ページ発行", () => {
  const org = { id: "org_new", slug: "soupcurry-kobo", name: "株式会社スープカレー工房", plan: "standard" as const, contractStatus: "trial" as const };
  const owner = member({ id: "u_owner_new", organizationId: "org_new", role: "owner", storeIds: [], email: "owner@soup.example.com" });

  it("新しい法人とオーナーを作成する（店舗は空）", () => {
    const s = demoReducer(createState(), { type: "createOrganization", organization: org, owner, at: AT });
    expect(s.organizations.find((o) => o.slug === "soupcurry-kobo")).toBeDefined();
    const created = s.members.find((m) => m.id === "u_owner_new");
    expect(created?.role).toBe("owner");
    expect(created?.organizationId).toBe("org_new");
    expect(s.stores.filter((x) => x.organizationId === "org_new")).toHaveLength(0);
  });

  it("URLに使えない・予約済み・重複した法人IDは拒否する", () => {
    const base = createState();
    for (const slug of ["Soup", "a", "admin", "login", "hokkai-food", "-bad-", "日本語"]) {
      expect(demoReducer(base, { type: "createOrganization", organization: { ...org, slug }, owner, at: AT })).toBe(base);
    }
  });

  it("既存ユーザーと同じメールアドレスでは発行できない", () => {
    const base = createState();
    const dup = { ...owner, email: "OWNER@example.com" };
    expect(demoReducer(base, { type: "createOrganization", organization: org, owner: dup, at: AT })).toBe(base);
  });
});

describe("店舗の追加とプラン上限", () => {
  it("オーナーはプランの上限まで店舗を追加でき、追加した店舗の担当になる", () => {
    const s = createState({ currentUserId: "user_hokkai_owner" });
    const next = demoReducer(s, { type: "addStore", store: store({ organizationId: "org_hokkai" }), at: AT });
    expect(next.stores.find((x) => x.id === "store_new")).toBeDefined();
    expect(next.members.find((m) => m.id === "user_hokkai_owner")?.storeIds).toContain("store_new");
  });

  it("STARTER（1店舗まで）は2店舗目を追加できない", () => {
    const s = createState({ currentUserId: "user_homura_owner" });
    expect(demoReducer(s, { type: "addStore", store: store({ organizationId: "org_homura" }), at: AT })).toBe(s);
  });

  it("他の法人に店舗を追加できない・オーナー以外は追加できない", () => {
    const s = createState({ currentUserId: "user_hokkai_owner" });
    expect(demoReducer(s, { type: "addStore", store: store({ organizationId: "org_namara" }), at: AT })).toBe(s);
    const manager = createState({ currentUserId: "user_hokkai_manager" });
    expect(demoReducer(manager, { type: "addStore", store: store({ organizationId: "org_hokkai" }), at: AT })).toBe(manager);
  });
});
