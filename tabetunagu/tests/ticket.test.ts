import { describe, expect, it } from "vitest";
import { pickupWindow } from "@/lib/monitor";
import {
  CONFIRM_RATIO,
  initialSwipe,
  pickupErrorMessage,
  PICKUP_ERROR_MESSAGE,
  reachedConfirm,
  swipeReducer,
  ticketTiming,
  type SwipeAction,
  type SwipeState,
} from "@/lib/ticket";

const NOW = new Date("2026-10-23T11:00:00Z"); // JST 20:00
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();

/** 受取時間（開始・終了を現在からの分で指定）。スワイプできる時間帯は既存の猶予（前10分・後15分） */
function order(startIn: number, endIn: number) {
  const pickupStartAt = at(startIn);
  const pickupEndAt = at(endIn);
  const { opensAt, closesAt } = pickupWindow(pickupStartAt, pickupEndAt);
  return { pickupStartAt, pickupEndAt, pickupOpensAt: new Date(opensAt).toISOString(), pickupClosesAt: new Date(closesAt).toISOString() };
}

describe("受取チケットの時間表示（ticketTiming）", () => {
  it("受取時間前: スワイプできない。60分以内は「受取開始まであと○分」、それより先は「HH:MMから受け取れます」", () => {
    expect(ticketTiming(order(30, 120), NOW)).toEqual({ kind: "upcoming", canSwipe: false, note: "受取開始まであと30分" });
    expect(ticketTiming(order(90, 180), NOW)).toEqual({ kind: "upcoming", canSwipe: false, note: "21:30から受け取れます" });
  });

  it("受取開始の少し前（早めの猶予）: スワイプできる", () => {
    expect(ticketTiming(order(5, 120), NOW)).toMatchObject({ kind: "active", canSwipe: true, note: "受取開始まであと5分" });
  });

  it("受取時間中: スワイプできる。終了まで60分以内は「受取終了まであと○分」を強調", () => {
    expect(ticketTiming(order(-30, 120), NOW)).toEqual({ kind: "active", canSwipe: true, note: null, urgent: false });
    expect(ticketTiming(order(-30, 45), NOW)).toEqual({ kind: "active", canSwipe: true, note: "受取終了まであと45分", urgent: true });
  });

  it("受取終了後の猶予（15分）: まだスワイプできる。猶予の終わりを出す", () => {
    expect(ticketTiming(order(-120, -10), NOW)).toEqual({
      kind: "grace",
      canSwipe: true,
      note: "受取時間を過ぎています（20:05まで受取完了にできます）",
      urgent: true,
    });
  });

  it("猶予も過ぎた: スワイプできない", () => {
    expect(ticketTiming(order(-120, -20), NOW)).toEqual({ kind: "closed", canSwipe: false, note: "受取時間を過ぎました" });
  });
});

const MAX = 200;
const run = (actions: SwipeAction[], from: SwipeState = initialSwipe) => actions.reduce(swipeReducer, from);

describe("スワイプ操作（swipeReducer）", () => {
  it("タップだけでは確定しない（押して離すだけ）", () => {
    expect(run([{ type: "down", clientX: 10, at: 0 }, { type: "up", maxX: MAX }])).toEqual({ phase: "idle", x: 0, error: null });
  });

  it("90% 未満で離すと確定せず初期位置へ戻る", () => {
    const s = run([
      { type: "down", clientX: 10, at: 0 },
      { type: "move", clientX: 10 + MAX * 0.89, maxX: MAX },
      { type: "up", maxX: MAX },
    ]);
    expect(s).toEqual({ phase: "idle", x: 0, error: null });
    expect(reachedConfirm(MAX * 0.89, MAX)).toBe(false);
  });

  it(`90% 以上で離すと確定（右端へ寄せて送信中）。CONFIRM_RATIO は ${CONFIRM_RATIO}`, () => {
    expect(CONFIRM_RATIO).toBe(0.9);
    const s = run([
      { type: "down", clientX: 10, at: 0 },
      { type: "move", clientX: 10 + MAX * 0.9, maxX: MAX },
      { type: "up", maxX: MAX },
    ]);
    expect(s).toEqual({ phase: "pending", x: MAX, error: null });
  });

  it("つまみは可動域の外へ出ない", () => {
    const s = run([
      { type: "down", clientX: 10, at: 0 },
      { type: "move", clientX: -500, maxX: MAX },
    ]);
    expect(s.x).toBe(0);
    expect(run([{ type: "down", clientX: 0, at: 0 }, { type: "move", clientX: 9999, maxX: MAX }]).x).toBe(MAX);
  });

  it("送信中は操作を受け付けない（二重送信しない）。完了後も動かせない", () => {
    const pending: SwipeState = { phase: "pending", x: MAX, error: null };
    for (const a of [
      { type: "down", clientX: 0, at: 0 },
      { type: "move", clientX: 50, maxX: MAX },
      { type: "up", maxX: MAX },
      { type: "key", key: "ArrowRight", maxX: MAX },
    ] as SwipeAction[]) {
      expect(swipeReducer(pending, a)).toBe(pending);
    }
    const done = swipeReducer(pending, { type: "result", ok: true });
    expect(done).toEqual({ phase: "done", x: MAX, error: null });
    expect(run([{ type: "down", clientX: 0, at: 0 }, { type: "key", key: "ArrowLeft", maxX: MAX }], done)).toBe(done);
  });

  it("失敗したら初期位置へ戻して文言を出し、もう一度操作できる", () => {
    const failed = swipeReducer({ phase: "pending", x: MAX, error: null }, { type: "result", ok: false, message: PICKUP_ERROR_MESSAGE });
    expect(failed).toEqual({ phase: "idle", x: 0, error: PICKUP_ERROR_MESSAGE });
    const retried = run(
      [
        { type: "down", clientX: 0, at: 0 },
        { type: "move", clientX: MAX, maxX: MAX },
        { type: "up", maxX: MAX },
      ],
      failed,
    );
    expect(retried.phase).toBe("pending");
  });

  it("キーボード: → キー1回では確定しない。右端まで動かすと確定。← で戻る", () => {
    const once = run([{ type: "key", key: "ArrowRight", maxX: MAX }]);
    expect(once).toEqual({ phase: "idle", x: MAX / 4, error: null });
    expect(run([{ type: "key", key: "ArrowLeft", maxX: MAX }], once)).toEqual({ phase: "idle", x: 0, error: null });
    const full = run(Array.from({ length: 4 }, () => ({ type: "key", key: "ArrowRight", maxX: MAX }) as SwipeAction));
    expect(full.phase).toBe("pending");
  });
});

describe("受取完了の失敗の文言（技術的なコードは出さない）", () => {
  it("通信エラー・不明なエラーは共通の文言、理由が分かるものはその文言", () => {
    expect(pickupErrorMessage(null)).toBe("受取完了を確認できませんでした。通信状況を確認して、もう一度お試しください。");
    expect(pickupErrorMessage({ ok: false, code: "unknown", message: "エラーが発生しました。" })).toBe(PICKUP_ERROR_MESSAGE);
    expect(pickupErrorMessage({ ok: false, code: "pickup_too_early", message: "まだ受取時間ではありません。" })).toBe("まだ受取時間ではありません。");
  });
});
