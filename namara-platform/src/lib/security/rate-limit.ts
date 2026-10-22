/**
 * 固定ウィンドウ方式のレート制限（インメモリ）。
 *
 * 1台のサーバー内でのみ有効です。本番（Vercel の複数インスタンス）では
 * Supabase のテーブルや Redis 系サービスに置き換える必要があります（docs/ARCHITECTURE.md）。
 */
export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now: number = Date.now()): RateLimitResult {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.sweep(now);
      return { allowed: true, remaining: this.limit - 1, resetAt: now + this.windowMs };
    }
    if (entry.count >= this.limit) return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    entry.count += 1;
    return { allowed: true, remaining: this.limit - entry.count, resetAt: entry.resetAt };
  }

  private sweep(now: number) {
    if (this.hits.size < 5000) return;
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}

const globalForLimits = globalThis as unknown as { __namaraLimits?: Record<string, RateLimiter> };

/** 用途ごとの共有リミッター */
export function limiter(name: "search" | "event" | "line_user" | "ad_click", limit: number, windowMs: number): RateLimiter {
  globalForLimits.__namaraLimits ??= {};
  globalForLimits.__namaraLimits[name] ??= new RateLimiter(limit, windowMs);
  return globalForLimits.__namaraLimits[name];
}
