import "server-only";
import { getVisibleCreators, type CreatorView } from "@/data/creators";
import { mediaFollowers, site } from "@/data/site";
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

/** なまらグルメの Instagram フォロワー数（自動取得できた場合は反映。単位：万人） */
export async function getMediaFollowers(): Promise<typeof mediaFollowers & { live: boolean }> {
  const live = await getInstagramFollowers(site.instagram.handle.replace(/^@/, ""));
  if (live === null) return { ...mediaFollowers, live: false };
  return { ...mediaFollowers, value: Math.floor(live / 1000) / 10, live: true };
}
