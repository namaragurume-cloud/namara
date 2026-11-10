import "server-only";
import { getVisibleCreators, type CreatorView } from "@/data/creators";
import { mediaFollowers, showFollowerCounts, site } from "@/data/site";
import { getInstagramFollowers } from "./instagram";

/** 公開中の発信者（Instagram のフォロワー数を自動取得できた場合は反映） */
export async function getCreatorsWithFollowers(): Promise<CreatorView[]> {
  const list = getVisibleCreators();
  if (!showFollowerCounts) return list;
  return Promise.all(
    list.map(async (c) => {
      if (c.platform !== "Instagram") return c;
      const live = await getInstagramFollowers(c.account);
      return live === null ? c : { ...c, followers: live, followersLive: true };
    }),
  );
}

/** 小さいカードの発信者がこの人数を超えたら、大きいカードに昇格 */
export const PROMOTE_FOLLOWERS = 10000;

/**
 * 大きいカード（creators）と小さいカード（network）に分けます。
 * - 小さいカードの発信者でもフォロワー1万人以上なら大きいカードへ（フォロワー数の多い順で後ろに追加）
 * - 小さいカードはフォロワー数の多い順（数値なしは最後）
 */
export function splitCreators(all: CreatorView[]): { creators: CreatorView[]; network: CreatorView[] } {
  const byFollowers = (a: CreatorView, b: CreatorView) => (b.followers ?? -1) - (a.followers ?? -1);
  const big = (c: CreatorView) => showFollowerCounts && c.followers !== undefined && c.followers >= PROMOTE_FOLLOWERS;
  const compact = all.filter((c) => c.size === "compact");
  return {
    creators: [...all.filter((c) => c.size !== "compact"), ...compact.filter(big).sort(byFollowers)],
    network: compact.filter((c) => !big(c)).sort(byFollowers),
  };
}

/** なまらグルメの Instagram フォロワー数（自動取得できた場合は反映。単位：万人） */
export async function getMediaFollowers(): Promise<typeof mediaFollowers & { live: boolean }> {
  const live = await getInstagramFollowers(site.instagram.handle.replace(/^@/, ""));
  if (live === null) return { ...mediaFollowers, live: false };
  return { ...mediaFollowers, value: Math.floor(live / 1000) / 10, live: true };
}
