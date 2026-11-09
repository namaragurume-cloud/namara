/**
 * デモモード（サンプルデータで管理画面を試せる。メッセージは実際には送らない）。
 *   - OPS_DEMO=true のとき
 *   - Vercel のプレビュー環境で、データの保存先（Redis）が未設定のとき（自動）
 * 本番環境（VERCEL_ENV=production）では、設定に関わらず無効です。
 */
export function isDemo(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.OPS_DEMO === "true") return true;
  const hasRedis = Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) && (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN),
  );
  return process.env.VERCEL_ENV === "preview" && !hasRedis;
}

export const DEMO_PASSWORD = "demo1234";
