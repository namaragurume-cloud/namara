import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { onboardingProgress, onboardingSteps, PICKUP_FLOW, pickupNoteNeedsUpdate, publishReasons, type OnboardingInput } from "@/lib/onboarding";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { getStoreOnboarding } from "@/server/services/onboarding";
import { createProduct, createTestDb, IDS } from "./support/db";

/** 店舗の「TABETUNAGU を始める準備」。進捗は実際の状態から毎回計算する */

const blank: OnboardingInput = {
  storeActive: true,
  missingInfo: ["住所", "電話番号", "営業時間"],
  pickupNote: "",
  payout: "not_started",
  productCount: 0,
  publishedCount: 0,
  monitorOpened: false,
  isOwner: true,
};
const keys = (i: OnboardingInput) => onboardingSteps(i).filter((s) => s.done).map((s) => s.key);

describe("進捗（5ステップ）", () => {
  it("0/5: 次にやることは店舗情報。未完了の各ステップに CTA が1つずつある", () => {
    const steps = onboardingSteps(blank);
    const p = onboardingProgress(steps);
    expect(p).toMatchObject({ done: 0, total: 5, complete: false, label: "0 / 5 完了" });
    expect(p.next!.key).toBe("info");
    expect(steps.map((s) => s.title)).toEqual(["店舗情報を確認", "売上受取設定", "最初の商品を登録", "公開準備を確認", "店舗モニターを体験"]);
    for (const s of steps) expect(s.cta).not.toBeNull();
    expect(steps[0].status).toBe("住所・電話番号・営業時間を入力してください。");
  });

  it("店舗情報 → 売上受取設定 → 商品登録 → 公開準備 → モニター確認の順に完了し、5/5 で完了", () => {
    const info = { ...blank, missingInfo: [], pickupNote: "入口すぐのカウンターでお渡しします。" };
    expect(keys(info)).toEqual(["info"]);
    const payout = { ...info, payout: "done" as const };
    expect(keys(payout)).toEqual(["info", "payout"]);
    expect(onboardingSteps(payout)[1].status).toBe("売上受取設定 完了");
    const product = { ...payout, productCount: 1 };
    expect(keys(product)).toEqual(["info", "payout", "product"]);
    expect(onboardingSteps(product)[2].status).toBe("商品は登録されています。公開設定をご確認ください。");
    expect(onboardingSteps(product)[3].status).toBe("公開できる商品がありません");
    const published = { ...product, publishedCount: 1 };
    expect(onboardingSteps(published)[3]).toMatchObject({ done: true, status: "準備ができました。商品を公開できます。" });
    const all = { ...published, monitorOpened: true };
    expect(onboardingProgress(onboardingSteps(all))).toMatchObject({ done: 5, complete: true, next: null, label: "5 / 5 完了" });
  });

  it("状態が戻れば進捗も戻る（完了フラグを持たない）", () => {
    const all: OnboardingInput = { ...blank, missingInfo: [], pickupNote: "カウンターで", payout: "done", productCount: 1, publishedCount: 1, monitorOpened: true };
    expect(onboardingProgress(onboardingSteps(all)).done).toBe(5);
    expect(onboardingProgress(onboardingSteps({ ...all, publishedCount: 0 })).done).toBe(4);
    expect(onboardingProgress(onboardingSteps({ ...all, payout: "in_progress" })).done).toBe(3); // 売上受取設定・公開準備
  });

  it("売上受取設定: 未開始は「始める」、途中は「あと少しで完了です」。技術用語は出さない", () => {
    expect(onboardingSteps(blank)[1]).toMatchObject({ status: "売上を受け取るための設定です。", cta: { label: "売上受取設定を始める", href: "/store/payouts" } });
    const mid = onboardingSteps({ ...blank, payout: "in_progress" })[1];
    expect(mid.status).toBe("あと少しで完了です。追加情報の入力が必要です。");
    expect(mid.cta!.label).toBe("売上受取設定を続ける");
    for (const s of onboardingSteps(blank)) expect(s.status).not.toMatch(/Stripe Connect|Express|charges_enabled|payouts_enabled|connect_ready/);
  });

  it("商品0件: 「商品を登録する」へ", () => {
    expect(onboardingSteps(blank)[2]).toMatchObject({ status: "最初の商品を出品してみましょう。", cta: { label: "商品を登録する" } });
  });

  it("スタッフ: 売上受取設定・店舗情報の CTA は出さない（オーナーが設定する）。モニター確認・商品登録は出す", () => {
    const steps = onboardingSteps({ ...blank, isOwner: false });
    expect(steps[0].cta).toBeNull();
    expect(steps[1].cta).toBeNull();
    expect(steps[1].status).toContain("店舗オーナーが設定します");
    expect(steps[2].cta).not.toBeNull();
    expect(steps[4].cta).toEqual({ label: "受取の流れを確認する", href: "/store/monitor" });
  });

  it("公開できない理由を具体的に。受取場所の案内（以前の方式の文言・未入力）は入力を勧める", () => {
    const reasons = publishReasons({ ...blank, missingInfo: ["住所"] }, { infoDone: false, payoutDone: false, productDone: true });
    expect(reasons).toEqual(["店舗情報の住所を入力してください", "売上受取設定を完了してください", "公開できる商品がありません"]);
    expect(pickupNoteNeedsUpdate("")).toBe(true);
    expect(pickupNoteNeedsUpdate("レジで「TABETUNAGUの予約です」とお伝えください。店頭のQRを読み取ってからお会計になります。")).toBe(true);
    expect(pickupNoteNeedsUpdate("1階レジ横でお渡しします")).toBe(false);
    const info = onboardingSteps({ ...blank, missingInfo: [] })[0];
    expect(info.done).toBe(true);
    expect(info.cta!.label).toBe("受取場所の案内を入れる");
  });

  it("受取の流れはチケットの仕様と同じ（商品を渡す → お客様がスワイプ → モニターに受取完了）", () => {
    expect(PICKUP_FLOW.map((f) => f.title)).toEqual(["お客様が来店", "受取チケットを確認", "商品をお渡しする", "お客様がスワイプ", "モニターに「受取完了」"]);
  });
});

let driver: Driver | undefined;

describe("店舗の状態から計算（DB）", () => {
  beforeEach(async () => {
    await driver?.close();
    driver = await createTestDb();
  });
  afterAll(async () => {
    await driver?.close();
  });

  it("新しい店舗は 0〜1/5。商品・売上受取設定・モニターの状態が変わると、次に開いたとき進捗に反映される（再開）", async () => {
    await asService((q) =>
      q.query("update public.stores set address = '', phone = '', opening_hours = '', pickup_note = '', stripe_account_id = null, stripe_charges_enabled = false, stripe_details_submitted = false where id = $1", [IDS.storeA]),
    );
    let o = await getStoreOnboarding(IDS.ownerA, IDS.storeA, true);
    expect(o.progress.done).toBe(0);
    await asService((q) => q.query("update public.stores set address = '札幌市中央区', phone = '011-000-0000', opening_hours = '10:00-20:00' where id = $1", [IDS.storeA]));
    await createProduct(IDS.storeA, { startIn: 30, endIn: 120 });
    await asService((q) => q.query("update public.stores set stripe_account_id = 'acct_testOnboarding1' where id = $1", [IDS.storeA]));
    o = await getStoreOnboarding(IDS.ownerA, IDS.storeA, true);
    expect(o.steps.find((s) => s.key === "payout")!.status).toBe("あと少しで完了です。追加情報の入力が必要です。");
    expect(o.progress.done).toBe(2); // 店舗情報・商品
    await asService((q) => q.query("update public.stores set stripe_charges_enabled = true, stripe_details_submitted = true where id = $1", [IDS.storeA]));
    await asService((q) => q.query("insert into public.events (name, store_id) values ('monitor_opened', $1)", [IDS.storeA]));
    o = await getStoreOnboarding(IDS.ownerA, IDS.storeA, true);
    expect(o.progress).toMatchObject({ done: 5, complete: true });
    expect(JSON.stringify(o)).not.toContain("acct_testOnboarding1");
  });

  it("他店舗のメンバー・一般ユーザーは見られない", async () => {
    await expect(getStoreOnboarding(IDS.staffB, IDS.storeA, false)).rejects.toBeInstanceOf(AppError);
    await expect(getStoreOnboarding(IDS.userA, IDS.storeA, false)).rejects.toBeInstanceOf(AppError);
    expect((await getStoreOnboarding(IDS.staffA, IDS.storeA, false)).steps).toHaveLength(5);
  });
});
