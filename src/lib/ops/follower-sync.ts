import "server-only";
import { creators as siteCreators } from "@/data/creators";
import { getInstagramFollowers } from "@/lib/instagram";
import { db } from "./db";
import { nowIso } from "./util";

/**
 * ホームページ（/creators）の発信者のフォロワー数を、管理ツールの発信者に取り込みます。
 * - アカウント名（@なし・大文字小文字は区別しない）が同じ発信者を連動
 * - 数値はホームページと同じ：Instagram API で取得できればその値、なければ src/data/creators.ts に入力した値
 */

export type SiteFollowers = { followers: number; live: boolean };

const key = (account: string) => account.replace(/^@/, "").trim().toLowerCase();

export async function siteFollowerMap(): Promise<Map<string, SiteFollowers>> {
  const entries = await Promise.all(
    siteCreators.map(async (c) => {
      const live = c.platform === "Instagram" ? await getInstagramFollowers(c.account) : null;
      const followers = live ?? c.followers;
      return followers === undefined ? null : ([key(c.account), { followers, live: live !== null }] as const);
    }),
  );
  return new Map(entries.filter((e): e is NonNullable<typeof e> => e !== null));
}

/** ホームページに載っているアカウントか */
export function isOnSite(account: string): boolean {
  return Boolean(account) && siteCreators.some((c) => key(c.account) === key(account));
}

/** フォロワー数を取り込む。戻り値：連動した人数・数値が変わった人数 */
export async function syncFollowersFromSite(): Promise<{ matched: number; updated: number }> {
  const [map, creators] = await Promise.all([siteFollowerMap(), db.list("creators")]);
  let matched = 0;
  let updated = 0;
  const at = nowIso();
  for (const c of creators) {
    const s = c.account ? map.get(key(c.account)) : undefined;
    if (!s) continue;
    matched++;
    if (c.followers !== s.followers) updated++;
    await db.update("creators", c.id, (x) => ({ ...x, followers: s.followers, followersSyncedAt: at }));
  }
  return { matched, updated };
}
