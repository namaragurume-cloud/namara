import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, type Db } from "@/lib/server/db";
import { ForbiddenError, type Actor } from "@/lib/server/authz";
import { getAdminOverview, getStoreDashboard, getStoreDemand, listStoresForAdmin } from "@/lib/server/services/dashboard-service";
import { createCampaign, listAllCampaigns, listStoreCampaigns, reviewCampaign, stopCampaignByStore } from "@/lib/server/services/ad-service";
import { setStorePublished } from "@/lib/server/services/store-service";

const NOW = new Date("2026-10-22T03:00:00Z");
const owner1: Actor = { kind: "store_member", userId: "u1", organizationId: "org-demo-1", storeIds: ["store-001", "store-002"], role: "owner" };
const staff1: Actor = { kind: "store_member", userId: "u2", organizationId: "org-demo-1", storeIds: ["store-001"], role: "staff" };
const owner2: Actor = { kind: "store_member", userId: "u3", organizationId: "org-demo-2", storeIds: ["store-003"], role: "owner" };
const operator: Actor = { kind: "operator", userId: "op" };
const anonymous: Actor = { kind: "anonymous" };

let db: Db;
beforeEach(() => {
  db = resetDb(NOW);
});

const campaignInput = (storeId: string) => ({
  storeId,
  name: "テスト",
  areaIds: ["susukino"],
  genreIds: ["yakiniku"],
  startDate: "2026-10-22",
  endDate: "2026-11-30",
  budgetYen: 9800,
});

describe("テナント分離（他社・他店舗のデータが見えない）", () => {
  it("自店のダッシュボードは見られる", () => {
    expect(getStoreDashboard(owner1, "store-001", db, NOW).store.id).toBe("store-001");
    expect(getStoreDashboard(owner2, "store-003", db, NOW).store.id).toBe("store-003");
  });

  it("他社の店舗のダッシュボード・需要分析・広告は見られない", () => {
    expect(() => getStoreDashboard(owner1, "store-003", db, NOW)).toThrow(ForbiddenError);
    expect(() => getStoreDemand(owner2, "store-001", "area", db, NOW)).toThrow(ForbiddenError);
    expect(() => listStoreCampaigns(owner2, "store-001", db)).toThrow(ForbiddenError);
  });

  it("同じ組織でも担当外の店舗は見られない（スタッフ）", () => {
    expect(() => getStoreDashboard(staff1, "store-002", db, NOW)).toThrow(ForbiddenError);
  });

  it("未ログインは何も見られない", () => {
    expect(() => getStoreDashboard(anonymous, "store-001", db, NOW)).toThrow(ForbiddenError);
    expect(() => getAdminOverview(anonymous, db, NOW)).toThrow(ForbiddenError);
  });

  it("店舗ユーザーは運営画面のデータを取得できない（権限昇格の防止）", () => {
    expect(() => getAdminOverview(owner1, db, NOW)).toThrow(ForbiddenError);
    expect(() => listStoresForAdmin(owner1, db)).toThrow(ForbiddenError);
    expect(() => listAllCampaigns(owner1, db)).toThrow(ForbiddenError);
    expect(() => setStorePublished(owner1, "store-001", false, db)).toThrow(ForbiddenError);
  });

  it("店舗ユーザーは自分の広告を承認できない", () => {
    const c = createCampaign(owner1, campaignInput("store-001"), db, NOW);
    expect(c.status).toBe("pending_review");
    expect(() => reviewCampaign(owner1, c.id, "approve", "", db, NOW)).toThrow(ForbiddenError);
    expect(reviewCampaign(operator, c.id, "approve", "OK", db, NOW).status).toBe("approved");
  });

  it("他社の店舗の広告は作成・停止できない", () => {
    expect(() => createCampaign(owner1, campaignInput("store-003"), db, NOW)).toThrow(ForbiddenError);
    const other = db.campaigns.find((c) => c.storeId === "store-003")!;
    expect(() => stopCampaignByStore(owner1, other.id, db, NOW)).toThrow(ForbiddenError);
  });

  it("スタッフは閲覧のみで広告を変更できない", () => {
    expect(() => createCampaign(staff1, campaignInput("store-001"), db, NOW)).toThrow(ForbiddenError);
  });

  it("店舗向けデータに生の検索文・セッションIDが含まれない", () => {
    const json = JSON.stringify(getStoreDemand(owner1, "store-001", "all", db, NOW));
    expect(json).not.toMatch(/syn-[0-9a-z]+"/);
    expect(json).not.toContain("rawText");
    expect(json).not.toContain("sessionId");
  });

  it("監査ログに広告操作が残る", () => {
    const c = createCampaign(owner1, campaignInput("store-001"), db, NOW);
    reviewCampaign(operator, c.id, "reject", "条件不一致", db, NOW);
    const actions = db.auditLogs.map((a) => a.action);
    expect(actions).toContain("campaign.create");
    expect(actions).toContain("campaign.reject");
  });
});

describe("広告キャンペーンの入力検証", () => {
  it("重複した対象エリアはまとめ、予算下限未満は受け付けない", () => {
    const db = resetDb(NOW);
    const c = createCampaign(owner1, { ...campaignInput("store-001"), areaIds: ["susukino", "susukino"] }, db, NOW);
    expect(c.targeting.areaIds).toEqual(["susukino"]);
    expect(() => createCampaign(owner1, { ...campaignInput("store-001"), budgetYen: 100 }, db, NOW)).toThrow();
    expect(() => createCampaign(owner1, { ...campaignInput("store-001"), endDate: "2026-10-01" }, db, NOW)).toThrow();
  });
});
