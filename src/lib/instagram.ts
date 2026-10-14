import "server-only";

/**
 * Instagram のフォロワー数を自動取得します（Instagram Graph API の Business Discovery）。
 *
 * 必要な環境変数：
 *   INSTAGRAM_BUSINESS_ACCOUNT_ID … なまらグルメ（プロアカウント）の Instagram ビジネスアカウント ID
 *   INSTAGRAM_ACCESS_TOKEN        … 上記アカウントに紐づくアクセストークン
 *   INSTAGRAM_GRAPH_VERSION       … API バージョン（任意。例: v23.0）
 *
 * - 取得できるのはプロアカウント（ビジネス／クリエイター）のみです。
 * - 結果は一定時間キャッシュされ、REVALIDATE_SECONDS ごとに更新されます。
 * - 未設定・取得失敗時は null を返し、各データの手入力の値を表示します。
 */

const REVALIDATE_SECONDS = 60 * 60 * 6; // 6時間

export function isInstagramConfigured(): boolean {
  return Boolean(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID && process.env.INSTAGRAM_ACCESS_TOKEN);
}

export async function getInstagramFollowers(username: string): Promise<number | null> {
  if (!isInstagramConfigured()) return null;
  const version = process.env.INSTAGRAM_GRAPH_VERSION || "v23.0";
  const id = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const fields = `business_discovery.username(${encodeURIComponent(username)}){followers_count}`;
  const url = `https://graph.facebook.com/${version}/${id}?fields=${fields}&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["instagram"] },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[instagram] ${username}: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { business_discovery?: { followers_count?: number } };
    const count = data.business_discovery?.followers_count;
    return typeof count === "number" ? count : null;
  } catch (err) {
    console.warn(`[instagram] ${username}: fetch failed`, err);
    return null;
  }
}
