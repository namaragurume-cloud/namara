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
    const manager = { role: "manager" as const, storeIds: ["a"] };
    expect(canOnStore(manager, "reply.approve", "a")).toBe(true);
    expect(canOnStore(manager, "reply.approve", "b")).toBe(false);
  });
});
