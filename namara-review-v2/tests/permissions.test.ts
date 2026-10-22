import { describe, expect, it } from "vitest";

import { can, canOnStore } from "@/lib/permissions";

describe("権限表", () => {
  it("スタッフは承認・設定変更・メンバー管理ができない", () => {
    expect(can("staff", "reply.edit")).toBe(true);
    expect(can("staff", "reply.approve")).toBe(false);
    expect(can("staff", "policy.edit")).toBe(false);
    expect(can("staff", "members.manage")).toBe(false);
  });

  it("店長はメンバー管理・請求確認ができない", () => {
    expect(can("manager", "reply.approve")).toBe(true);
    expect(can("manager", "members.manage")).toBe(false);
    expect(can("manager", "billing.view")).toBe(false);
  });

  it("担当店舗以外では権限があっても操作できない", () => {
    const manager = { role: "manager" as const, storeIds: ["a"], organizationId: "org1" };
    expect(canOnStore(manager, "reply.approve", { id: "a", organizationId: "org1" })).toBe(true);
    expect(canOnStore(manager, "reply.approve", { id: "b", organizationId: "org1" })).toBe(false);
  });

  it("オーナーでも他の法人の店舗は操作できない（テナント分離）", () => {
    const owner = { role: "owner" as const, storeIds: ["a"], organizationId: "org1" };
    expect(canOnStore(owner, "reply.approve", { id: "x", organizationId: "org2" })).toBe(false);
    // 店舗IDが一致していても法人が違えば不可
    expect(canOnStore(owner, "reply.approve", { id: "a", organizationId: "org2" })).toBe(false);
    expect(canOnStore(owner, "reply.approve", undefined)).toBe(false);
  });
});
