import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** サービス UI では「レスキュー」「救う」を使わない（TABETE との差別化・ブランド方針） */
const FORBIDDEN = [/レスキュー/, /救[うおいえっわ]/, /半額/];
// 禁止語リストそのものを定義しているファイルは除外
const ALLOW = new Set(["src/lib/ai-copy.ts", "src/server/services/ai.ts"]);

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : Promise.resolve([path.join(dir, e.name)]))),
  );
  return files.flat();
}

describe("コピーガイドライン", () => {
  it("UI ソースに禁止語が含まれていない", async () => {
    const root = path.resolve(__dirname, "..");
    const files = (await walk(path.join(root, "src"))).filter((f) => /\.(tsx?|css)$/.test(f));
    const violations: string[] = [];
    for (const file of files) {
      const rel = path.relative(root, file);
      if (ALLOW.has(rel)) continue;
      const text = await readFile(file, "utf8");
      for (const re of FORBIDDEN) if (re.test(text)) violations.push(`${rel}: ${re}`);
    }
    expect(violations).toEqual([]);
  });
});
