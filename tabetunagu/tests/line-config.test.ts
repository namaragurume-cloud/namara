import { afterEach, describe, expect, it } from "vitest";
import { lineConfigIssues } from "@/server/auth/line";

/** LINE ログインの設定の問題（ログでの原因の特定用。値は返さない） */
const KEYS = ["LINE_CHANNEL_ID", "LINE_CHANNEL_SECRET", "NEXT_PUBLIC_LIFF_ID"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
function setEnv(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) {
    if (values[k] === undefined) delete process.env[k];
    else process.env[k] = values[k];
  }
}

describe("lineConfigIssues", () => {
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("LIFF ID のチャネルと LINE_CHANNEL_ID が一致していれば問題なし", () => {
    setEnv({ LINE_CHANNEL_ID: "2012185838", LINE_CHANNEL_SECRET: "secret-value", NEXT_PUBLIC_LIFF_ID: "2012185838-umUnZJWr" });
    expect(lineConfigIssues()).toEqual([]);
  });

  it("別のチャネル（Messaging API など）の ID だと不一致を報告する（値は含めない）", () => {
    setEnv({ LINE_CHANNEL_ID: "1999999999", LINE_CHANNEL_SECRET: "secret-value", NEXT_PUBLIC_LIFF_ID: "2012185838-umUnZJWr" });
    const issues = lineConfigIssues();
    expect(issues).toEqual(["LINE_CHANNEL_ID does not match the channel of NEXT_PUBLIC_LIFF_ID"]);
    expect(issues.join()).not.toMatch(/1999999999|2012185838|secret-value/);
  });

  it("未設定の項目を報告する", () => {
    setEnv({});
    expect(lineConfigIssues()).toEqual(["LINE_CHANNEL_ID not set", "LINE_CHANNEL_SECRET not set", "NEXT_PUBLIC_LIFF_ID not set"]);
  });
});
