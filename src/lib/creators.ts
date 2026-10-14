import "server-only";
import { getVisibleCreators, type CreatorView } from "@/data/creators";
import { site, stats, type Stat } from "@/data/site";
import { getInstagramFollowers } from "./instagram";

/** 公開中の発信者（Instagram のフォロワー数を自動取得できた場合は反映） */
export async function getCreatorsWithFollowers(): Promise<CreatorView[]> {
  const list = getVisibleCreators();
  return Promise.all(
    list.map(async (c) => {
      if (c.platform !== "Instagram") return c;
      const live = await getInstagramFollowers(c.account);
      return live === null ? c : { ...c, followers: live, followersLive: true };
    }),
  );
}

/** トップの数値（なまらグルメのフォロワー数を自動取得できた場合は反映） */
export async function getLiveStats(): Promise<{ asOf: string; live: boolean; items: Stat[] }> {
  const handle = site.instagram.handle.replace(/^@/, "");
  const live = await getInstagramFollowers(handle);
  if (live === null) return { ...stats, live: false };
  const [first, ...rest] = stats.items;
  return {
    ...stats,
    live: true,
    items: [{ ...first, value: Math.floor(live / 1000) / 10 }, ...rest],
  };
}
