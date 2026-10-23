import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/server/auth/line";

const { GET: lineCallbackGET } = await import("@/app/api/auth/line/callback/route");

/** LINE ミニアプリ・外部ブラウザでのログインと復帰（オープンリダイレクトを作らない） */
describe("safeNextPath（ログイン後の戻り先）", () => {
  it.each([
    ["/products/abc", "/products/abc"],
    ["/products/abc/buy", "/products/abc/buy"],
    ["/orders", "/orders"],
    ["/orders/0b8f/x?from=checkout", "/orders/0b8f/x?from=checkout"],
    ["/me?tab=1#top", "/me?tab=1#top"],
    ["/%0a", "/%0a"], // エンコード済み（パスとして扱われる）
  ])("自サイト内のパスはそのまま: %s", (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });

  it.each([
    "https://evil.example/",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
    "evil.example",
    "",
  ])("外部・不正な戻り先は既定値へ: %j", (next) => {
    expect(safeNextPath(next, "/")).toBe("/");
  });

  it("長すぎる戻り先は既定値へ", () => {
    expect(safeNextPath(`/${"a".repeat(3000)}`)).toBe("/");
  });
});

describe("LINE Login の失敗・キャンセル", () => {
  it("同意画面でキャンセルしても、もう一度ログインすれば元の画面（購入確認）へ戻れるよう next を残す", async () => {
    const req = new NextRequest("http://localhost/api/auth/line/callback?error=access_denied&state=s1");
    req.cookies.set("tt_line_oauth", JSON.stringify({ state: "s1", nonce: "n", next: "/products/abc/buy" }));
    const res = await lineCallbackGET(req);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("login_failed");
    expect(location.searchParams.get("next")).toBe("/products/abc/buy");
  });

  it("保存された戻り先が外部 URL なら残さない", async () => {
    const req = new NextRequest("http://localhost/api/auth/line/callback?state=s1");
    req.cookies.set("tt_line_oauth", JSON.stringify({ state: "s1", nonce: "n", next: "//evil.example" }));
    const res = await lineCallbackGET(req);
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("next")).toBeNull();
  });
});
