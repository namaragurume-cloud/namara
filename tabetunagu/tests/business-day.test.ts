import { afterEach, describe, expect, it, vi } from "vitest";
import { BUSINESS_DAY_CUTOFF_HOUR, businessDate, businessDayRange, overlapsBusinessDay } from "@/lib/business-day";

/** 実際の現在時刻は使わない。システム時刻を JST の固定日時にする */
function at(jst: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${jst}+09:00`));
  return new Date();
}

afterEach(() => {
  vi.useRealTimers();
});

describe("営業日（JST 03:00 切替）", () => {
  it("切替時刻は 03:00", () => {
    expect(BUSINESS_DAY_CUTOFF_HOUR).toBe(3);
  });

  it.each([
    ["2026-10-23T22:59:00", "2026-10-23"],
    ["2026-10-23T23:59:00", "2026-10-23"],
    ["2026-10-24T00:00:00", "2026-10-23"],
    ["2026-10-24T00:14:00", "2026-10-23"],
    ["2026-10-24T00:30:00", "2026-10-23"],
    ["2026-10-24T02:59:00", "2026-10-23"],
    ["2026-10-24T02:59:59", "2026-10-23"],
    ["2026-10-24T03:00:00", "2026-10-24"],
    ["2026-10-24T03:01:00", "2026-10-24"],
  ])("JST %s → %s 営業日", (jst, date) => {
    expect(businessDate(at(jst))).toBe(date);
  });

  it("範囲は営業日の 03:00〜翌日 03:00（JST を明示）", () => {
    const r = businessDayRange(at("2026-10-24T00:30:00"));
    expect(r).toEqual({ date: "2026-10-23", start: new Date("2026-10-23T03:00:00+09:00"), end: new Date("2026-10-24T03:00:00+09:00") });
    expect(r.start.toISOString()).toBe("2026-10-22T18:00:00.000Z");
  });

  it("月末・年末もまたげる", () => {
    expect(businessDate(at("2026-11-01T02:00:00"))).toBe("2026-10-31");
    expect(businessDate(at("2027-01-01T02:59:00"))).toBe("2026-12-31");
    expect(businessDate(at("2027-01-01T03:00:00"))).toBe("2027-01-01");
  });

  it("受取時間が営業日の範囲に重なるか（日付またぎ・境界）", () => {
    const now = at("2026-10-23T23:59:00");
    expect(overlapsBusinessDay("2026-10-24T00:14:00+09:00", "2026-10-24T01:14:00+09:00", now)).toBe(true); // 翌 0:14 開始
    expect(overlapsBusinessDay("2026-10-24T03:00:00+09:00", "2026-10-24T04:00:00+09:00", now)).toBe(false); // 次の営業日
    expect(overlapsBusinessDay("2026-10-23T02:00:00+09:00", "2026-10-23T02:59:00+09:00", now)).toBe(false); // 前の営業日
    expect(overlapsBusinessDay("2026-10-23T02:30:00+09:00", "2026-10-23T03:00:00+09:00", now)).toBe(true); // 03:00 ちょうどに終わる
  });
});
