import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, signSession } from "@/server/auth/session";
import type { Driver } from "@/server/db/types";
import { createTestDb, IDS } from "./support/db";

const line = vi.hoisted(() => ({ verify: vi.fn(), upsert: vi.fn() }));
vi.mock("@/server/auth/line", () => ({ verifyLineIdToken: line.verify, upsertLineUser: line.upsert, lineConfigIssues: () => [] }));
const { POST } = await import("@/app/api/auth/liff/route");

/** LINE ミニアプリの自動ログイン（LIFF）が、管理者のデモログインなど既存のセッションを上書きしない */
const saved = process.env.LINE_CHANNEL_ID;
let driver: Driver | undefined;

function request(cookie?: string) {
  return new NextRequest("http://localhost/api/auth/liff", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ idToken: "line-id-token-xxxxxxxx" }),
  });
}

describe("POST /api/auth/liff", () => {
  beforeEach(async () => {
    await driver?.close();
    driver = await createTestDb();
    process.env.LINE_CHANNEL_ID = "1234567890";
    line.verify.mockReset().mockResolvedValue({ sub: `U${"b".repeat(32)}`, name: "LINE ユーザー", picture: null, email: null });
    line.upsert.mockReset().mockResolvedValue(IDS.userA);
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.LINE_CHANNEL_ID;
    else process.env.LINE_CHANNEL_ID = saved;
  });
  afterAll(async () => {
    await driver?.close();
  });

  it("ログインしていなければ LINE のユーザーでログインする", async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(line.verify).toHaveBeenCalledOnce();
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBeTruthy();
  });

  it("管理者としてログイン済みなら、セッションを上書きしない", async () => {
    const res = await POST(request(`${SESSION_COOKIE}=${await signSession(IDS.admin)}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, kept: true });
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
    expect(line.verify).not.toHaveBeenCalled();
    expect(line.upsert).not.toHaveBeenCalled();
  });

  it("無効・存在しないユーザーのセッションなら、LINE のユーザーでログインし直す", async () => {
    for (const cookie of [`${SESSION_COOKIE}=broken`, `${SESSION_COOKIE}=${await signSession("90000000-0000-4000-8000-000000000009")}`]) {
      line.verify.mockClear();
      const res = await POST(request(cookie));
      expect(res.status).toBe(200);
      expect(line.verify).toHaveBeenCalledOnce();
      expect(res.cookies.get(SESSION_COOKIE)?.value).toBeTruthy();
    }
  });
});
