import "server-only";
import {
  DIGEST_MAX_CONSECUTIVE_FAILURES,
  DIGEST_MAX_TARGETS_PER_RUN,
  DIGEST_REPEAT_DAYS,
  digestCards,
  digestFlexMessage,
  jstDate,
  selectDigestProducts,
  type DigestCandidate,
} from "@/lib/featured-digest";
import { AppError } from "@/lib/errors";
import { asService } from "../db";
import { env } from "../env";
import { PUSH_DEMO_INTERVAL_MS, type MarketingErrorCategory } from "./line-marketing";

/**
 * LINE 日次注目商品通知（「今夜の食べつなぎ」）。LINE 公式アカウントの Messaging API（Push）で、1人ずつ送る。
 * - 対象: 通知を ON にした（オプトイン）・LINE の userId あり・デモユーザーではない・公式アカウントの友だち（プロフィールを取得できる）
 * - 1人1日1回（配信日ごとの一意インデックス。失敗しても同じ日に再送しない）。連続3回失敗したら ON にし直すまで送らない
 * - ENABLE_LINE_DIGEST_SEND=true でなければ dry run（LINE には一切問い合わせず、記録だけ）
 * - Broadcast / Multicast / Narrowcast は使わない。LINE の userId・トークンは記録・画面に出さない
 */

export type DigestRunResult = {
  mode: "dry_run" | "live";
  date: string;
  products: number;
  targets: number;
  sent: number;
  failed: number;
  skipped: number;
  dryRun: number;
  aborted: MarketingErrorCategory | null;
};

type Target = { id: string; line_user_id: string };

const PRODUCT_COLUMNS = `p.id, p.name, p.image_url, p.original_price, p.rescue_price, p.remaining_quantity, p.is_box,
  p.pickup_start_at, p.pickup_end_at, s.id as store_id, s.name as store_name`;

function toCandidate(r: Record<string, unknown>): DigestCandidate {
  return {
    id: String(r.id),
    storeId: String(r.store_id),
    name: String(r.name),
    storeName: String(r.store_name),
    imageUrl: (r.image_url as string | null) ?? null,
    originalPrice: Number(r.original_price),
    rescuePrice: Number(r.rescue_price),
    remaining: Number(r.remaining_quantity),
    isBox: Boolean(r.is_box),
    pickupStartAt: new Date(r.pickup_start_at as string).toISOString(),
    pickupEndAt: new Date(r.pickup_end_at as string).toISOString(),
  };
}

/** 候補の商品（公開中・稼働中の店舗・在庫あり・受取終了前）。細かい条件は selectDigestProducts */
export async function listDigestCandidates(now = new Date()): Promise<DigestCandidate[]> {
  const rows = await asService((q) =>
    q.query<Record<string, unknown>>(
      `select ${PRODUCT_COLUMNS}
       from public.products p join public.stores s on s.id = p.store_id
       where p.status = 'published' and p.deleted_at is null and s.status = 'active'
         and p.remaining_quantity > 0 and p.pickup_end_at > $1::timestamptz
       order by p.pickup_end_at limit 200`,
      [now.toISOString()],
    ),
  );
  return rows.map(toCandidate);
}

/** 今日の配信対象（まだ今日の分を送っていない人だけ） */
async function listTargets(date: string): Promise<Target[]> {
  return asService((q) =>
    q.query<Target>(
      `select u.id, u.line_user_id
       from public.users u
       where u.line_featured_opt_in and not u.is_demo and u.line_user_id ~ '^U[0-9a-f]{32}$'
         and not exists (
           select 1 from public.line_push_message_logs l
           where l.target_user_id = u.id and l.notification_type = 'featured_daily'
             and l.delivery_date = $1::date and l.status in ('pending', 'sent', 'failed'))
         and (select count(*) from (
                select l.status from public.line_push_message_logs l
                where l.target_user_id = u.id and l.notification_type = 'featured_daily' and l.status in ('sent', 'failed')
                  and l.created_at >= coalesce(u.line_featured_opt_in_at, '-infinity'::timestamptz)
                order by l.created_at desc limit $2) recent
              where recent.status = 'failed') < $2
       order by u.line_featured_opt_in_at nulls last, u.id
       limit $3`,
      [date, DIGEST_MAX_CONSECUTIVE_FAILURES, DIGEST_MAX_TARGETS_PER_RUN],
    ),
  );
}

/** ユーザーごとの、直近に送った商品（同じ商品を何日も続けて送らないため） */
async function recentlySentProducts(userIds: string[], now: Date): Promise<Map<string, string[]>> {
  if (userIds.length === 0) return new Map();
  const rows = await asService((q) =>
    q.query<{ user_id: string; ids: string | null }>(
      `select l.target_user_id as user_id, string_agg(distinct pid::text, ',') as ids
       from public.line_push_message_logs l, unnest(l.product_ids) pid
       where l.target_user_id::text = any(string_to_array($1, ','))
         and l.notification_type = 'featured_daily' and l.status = 'sent'
         and l.sent_at > $2::timestamptz - make_interval(days => $3)
       group by l.target_user_id`,
      [userIds.join(","), now.toISOString(), DIGEST_REPEAT_DAYS],
    ),
  );
  return new Map(rows.map((r) => [r.user_id, r.ids ? r.ids.split(",") : []]));
}

async function insertLog(
  type: "featured_daily" | "featured_daily_test",
  userId: string,
  productIds: string[],
  date: string,
  status: "pending" | "sent" | "failed" | "skipped" | "dry_run",
  category: string | null,
): Promise<string | null> {
  const [row] = await asService((q) =>
    q.query<{ id: string }>(
      `insert into public.line_push_message_logs (notification_type, target_user_id, product_ids, delivery_date, status, error_category, sent_at)
       values ($1, $2, string_to_array($3, ',')::uuid[], $4::date, $5, $6, case when $5 = 'sent' then now() else null end)
       on conflict (target_user_id, delivery_date) where notification_type = 'featured_daily' and status in ('pending', 'sent', 'failed')
       do nothing
       returning id`,
      [type, userId, productIds.join(","), date, status, category],
    ),
  );
  return row?.id ?? null;
}

async function finishLog(id: string, status: "sent" | "failed" | "skipped", category: string | null) {
  await asService((q) =>
    q.query(
      `update public.line_push_message_logs set status = $2, error_category = $3, sent_at = case when $2 = 'sent' then now() else null end
       where id = $1`,
      [id, status, category],
    ),
  );
}

function categoryForStatus(status: number): MarketingErrorCategory {
  if (status === 400) return "bad_request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  return "line_unavailable";
}

/** 設定・権限・回数制限の問題（他のユーザーでも同じく失敗する）なら、その回の実行を止める */
const ABORTS = new Set<MarketingErrorCategory>(["unauthorized", "forbidden", "rate_limited", "network_error"]);

async function lineFetch(url: string, init: RequestInit): Promise<{ ok: true } | { ok: false; status: number | null; category: MarketingErrorCategory }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${env.line.messagingAccessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    return { ok: false, status: res.status, category: categoryForStatus(res.status) };
  } catch {
    return { ok: false, status: null, category: "network_error" };
  }
}

/** 公式アカウントの友だちか（ブロック・友だち未追加なら LINE は 404 を返す） */
function checkFriend(lineUserId: string) {
  return lineFetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`, { method: "GET" });
}

function push(lineUserId: string, products: DigestCandidate[], retryKey: string, now: Date) {
  const cards = digestCards(products, { liffId: env.line.liffId, appUrl: env.appUrl, now });
  return lineFetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    // 通信の再試行で二重に届かないように、送信記録の ID を再試行キーにする
    headers: { "content-type": "application/json", "x-line-retry-key": retryKey },
    body: JSON.stringify({ to: lineUserId, messages: [digestFlexMessage(cards)] }),
  });
}

/**
 * 日次注目商品通知を実行する（管理者の手動実行・定期処理）。
 * ENABLE_LINE_DIGEST_SEND=true でなければ dry run（LINE には問い合わせない）。
 */
export async function runFeaturedDigest(now = new Date()): Promise<DigestRunResult> {
  const live = env.line.digestSendEnabled;
  const date = jstDate(now);
  const result: DigestRunResult = { mode: live ? "live" : "dry_run", date, products: 0, targets: 0, sent: 0, failed: 0, skipped: 0, dryRun: 0, aborted: null };

  const candidates = await listDigestCandidates(now);
  result.products = selectDigestProducts(candidates, now).length;
  // 今日の商品が1件もなければ誰にも送らない
  if (result.products === 0) return result;

  const targets = await listTargets(date);
  result.targets = targets.length;
  const recent = await recentlySentProducts(
    targets.map((t) => t.id),
    now,
  );

  for (const t of targets) {
    const products = selectDigestProducts(candidates, now, recent.get(t.id) ?? []);
    const ids = products.map((p) => p.id);
    if (products.length === 0) {
      await insertLog("featured_daily", t.id, [], date, "skipped", "no_products");
      result.skipped += 1;
      continue;
    }
    if (!live) {
      await insertLog("featured_daily", t.id, ids, date, "dry_run", null);
      result.dryRun += 1;
      continue;
    }
    // 先に「送信中」として1件だけ記録する（同時に実行されても二重に送らない）
    const logId = await insertLog("featured_daily", t.id, ids, date, "pending", null);
    if (!logId) {
      result.skipped += 1;
      continue;
    }
    const friend = await checkFriend(t.line_user_id);
    if (!friend.ok) {
      const category = friend.status === 404 ? "not_friend" : friend.category;
      await finishLog(logId, "skipped", category);
      result.skipped += 1;
      if (friend.status !== 404 && ABORTS.has(friend.category)) {
        result.aborted = friend.category;
        break;
      }
      continue;
    }
    const sent = await push(t.line_user_id, products, logId, now);
    if (sent.ok) {
      await finishLog(logId, "sent", null);
      result.sent += 1;
    } else {
      // 失敗はその日の1回として記録し、同じ日に再送しない
      await finishLog(logId, "failed", sent.category);
      result.failed += 1;
      console.error("[line-digest] push failed", sent.category, sent.status);
      if (ABORTS.has(sent.category)) {
        result.aborted = sent.category;
        break;
      }
    }
  }
  return result;
}

/**
 * 管理者が自分の LINE にだけ、今日の「今夜の食べつなぎ」を1件送る（手動テスト。呼び出し側で管理者であることを確認すること）。
 * 実際に送るのは ENABLE_LINE_MARKETING_DEMO=true（自分へのテスト送信）または ENABLE_LINE_DIGEST_SEND=true のときだけ。
 */
export async function sendDigestTestToSelf(adminUserId: string, now = new Date()): Promise<{ ok: true; products: number } | { ok: false; category: MarketingErrorCategory | "no_products" }> {
  if (!env.line.marketingDemoEnabled && !env.line.digestSendEnabled) return { ok: false, category: "not_enabled" };
  if (!env.line.messagingAccessToken) return { ok: false, category: "not_configured" };
  const products = selectDigestProducts(await listDigestCandidates(now), now);
  if (products.length === 0) return { ok: false, category: "no_products" };
  const [u] = await asService((q) =>
    q.query<{ line_user_id: string | null; recent: boolean }>(
      `select u.line_user_id,
              exists (select 1 from public.line_push_message_logs l where l.target_user_id = u.id and l.status = 'sent'
                        and l.notification_type = 'featured_daily_test'
                        and l.sent_at > $2::timestamptz - make_interval(secs => $3)) as recent
       from public.users u where u.id = $1`,
      [adminUserId, now.toISOString(), PUSH_DEMO_INTERVAL_MS / 1000],
    ),
  );
  if (!u?.line_user_id || !/^U[0-9a-f]{32}$/.test(u.line_user_id)) return { ok: false, category: "not_line_user" };
  const date = jstDate(now);
  const ids = products.map((p) => p.id);
  if (u.recent) {
    await insertLog("featured_daily_test", adminUserId, ids, date, "skipped", "duplicate");
    return { ok: false, category: "duplicate" };
  }
  const logId = await insertLog("featured_daily_test", adminUserId, ids, date, "pending", null);
  if (!logId) return { ok: false, category: "duplicate" };
  const sent = await push(u.line_user_id, products, logId, now);
  if (!sent.ok) {
    console.error("[line-digest] test push failed", sent.category, sent.status);
    await finishLog(logId, "failed", sent.category);
    return { ok: false, category: sent.category };
  }
  await finishLog(logId, "sent", null);
  return { ok: true, products: products.length };
}

/** ユーザーの「今日の注目商品」通知の設定 */
export async function getFeaturedOptIn(userId: string) {
  const [row] = await asService((q) =>
    q.query<{ on: boolean; line: boolean }>(
      "select line_featured_opt_in as on, line_user_id is not null as line from public.users where id = $1",
      [userId],
    ),
  );
  return { on: Boolean(row?.on), lineLinked: Boolean(row?.line) };
}

/** ON / OFF を切り替える（本人の明示的な操作だけ）。ON にした日時を同意の記録として残す */
export async function setFeaturedOptIn(userId: string, on: boolean) {
  await asService(async (q) => {
    const [u] = await q.query<{ line: boolean }>("select line_user_id is not null as line from public.users where id = $1", [userId]);
    if (!u) throw new AppError("forbidden");
    if (on && !u.line) throw new AppError("validation", "LINEでログインすると、通知を受け取れます。");
    await q.query(
      `update public.users set line_featured_opt_in = $2,
         line_featured_opt_in_at = case when $2 then now() else line_featured_opt_in_at end
       where id = $1`,
      [userId, on],
    );
  });
}

/** 管理画面「LINE日次通知」の集計（LINE の userId・トークンは返さない） */
export async function getDigestDashboard(now = new Date()) {
  const date = jstDate(now);
  const candidates = await listDigestCandidates(now);
  const products = selectDigestProducts(candidates, now);
  const [counts] = await asService((q) =>
    q.query<{ opt_in: number; eligible: number; demo_opt_in: number }>(
      `select count(*) filter (where line_featured_opt_in)::int as opt_in,
              count(*) filter (where line_featured_opt_in and not is_demo and line_user_id ~ '^U[0-9a-f]{32}$')::int as eligible,
              count(*) filter (where line_featured_opt_in and is_demo)::int as demo_opt_in
       from public.users`,
    ),
  );
  const statuses = await asService((q) =>
    q.query<{ status: string; count: number }>(
      `select status, count(*)::int as count from public.line_push_message_logs
       where notification_type = 'featured_daily' and delivery_date = $1::date group by status`,
      [date],
    ),
  );
  const byStatus = Object.fromEntries(statuses.map((s) => [s.status, s.count])) as Record<string, number>;
  const recent = await asService((q) =>
    q.query<{ notification_type: string; status: string; error_category: string | null; product_count: number; created_at: Date }>(
      `select notification_type, status, error_category, coalesce(array_length(product_ids, 1), 0)::int as product_count, created_at
       from public.line_push_message_logs where notification_type in ('featured_daily', 'featured_daily_test')
       order by created_at desc limit 10`,
    ),
  );
  return {
    date,
    optIn: counts?.opt_in ?? 0,
    eligible: counts?.eligible ?? 0,
    demoOptIn: counts?.demo_opt_in ?? 0,
    today: {
      sent: byStatus.sent ?? 0,
      failed: byStatus.failed ?? 0,
      skipped: byStatus.skipped ?? 0,
      dryRun: byStatus.dry_run ?? 0,
      pending: byStatus.pending ?? 0,
    },
    cards: digestCards(products, { liffId: env.line.liffId, appUrl: env.appUrl, now }),
    recent,
  };
}
