import "server-only";
import { AREAS, areaLabel } from "@/lib/categories";
import { brand } from "@/lib/brand";
import { asService } from "../db";
import { env } from "../env";

/**
 * まとめ通知（例: 18:00「今夜のTABETUNAGU」）。
 * 商品ごとに全員へ送らない。1人1日1通まで。エリアを登録しているユーザーにはそのエリアだけを伝える。
 */
export const DIGEST_COOLDOWN_HOURS = 20;

export type DigestPreview = {
  title: string;
  areaCounts: { areaId: string; label: string; count: number }[];
  total: number;
  targets: { userId: string; lineUserId: string | null; message: string }[];
  sample: string;
};

export function buildDigestMessage(counts: { label: string; count: number }[], appUrl: string, favoriteLine?: string) {
  const lines = counts.filter((c) => c.count > 0).map((c) => `${c.label}：${c.count}件`);
  return [
    "今夜のTABETUNAGU",
    "",
    ...lines,
    ...(favoriteLine ? ["", favoriteLine] : []),
    "",
    brand.tagline,
    appUrl,
  ].join("\n");
}

export async function previewEveningDigest(): Promise<DigestPreview> {
  return asService(async (q) => {
    const counts = await q.query<{ area_id: string; count: number }>(
      `select s.area_id, count(*)::int as count
       from public.products p join public.stores s on s.id = p.store_id
       where s.status = 'active' and p.status = 'published' and p.deleted_at is null
         and p.remaining_quantity > 0 and p.pickup_end_at > now() + interval '30 minutes'
       group by s.area_id`,
    );
    const byArea = new Map(counts.map((c) => [c.area_id, c.count]));
    const areaCounts = AREAS.map((a) => ({ areaId: a.id, label: a.label, count: byArea.get(a.id) ?? 0 }));
    const total = areaCounts.reduce((s, a) => s + a.count, 0);

    // お気に入り店舗のうち STANDARD（お気に入り通知機能あり）で出品中の店舗
    const favorites = await q.query<{ user_id: string; store_name: string }>(
      `select f.user_id, s.name as store_name
       from public.favorites f join public.stores s on s.id = f.store_id
       where s.status = 'active' and s.plan_code = 'standard'
         and exists (select 1 from public.products p where p.store_id = s.id and p.status = 'published'
                       and p.deleted_at is null and p.remaining_quantity > 0 and p.pickup_end_at > now())`,
    );
    const favByUser = new Map<string, string[]>();
    for (const f of favorites) favByUser.set(f.user_id, [...(favByUser.get(f.user_id) ?? []), f.store_name]);

    const users = await q.query<{ id: string; line_user_id: string | null; notify_areas: string[] }>(
      `select u.id, u.line_user_id, u.notify_areas
       from public.users u
       where u.notify_enabled
         and not exists (
           select 1 from public.notification_deliveries d join public.notifications n on n.id = d.notification_id
           where d.user_id = u.id and n.kind = 'evening_digest' and d.status in ('pending', 'sent')
             and d.created_at > now() - make_interval(hours => $1)
         )`,
      [DIGEST_COOLDOWN_HOURS],
    );

    const targets: DigestPreview["targets"] = [];
    for (const u of users) {
      const areas = u.notify_areas?.length ? areaCounts.filter((a) => u.notify_areas.includes(a.areaId)) : areaCounts;
      if (areas.every((a) => a.count === 0)) continue;
      const fav = favByUser.get(u.id);
      const favoriteLine = fav?.length ? `お気に入り：${fav[0]}${fav.length > 1 ? ` ほか${fav.length - 1}店` : ""}が出品中` : undefined;
      targets.push({ userId: u.id, lineUserId: u.line_user_id, message: buildDigestMessage(areas, env.appUrl, favoriteLine) });
    }
    return {
      title: "今夜のTABETUNAGU",
      areaCounts,
      total,
      targets,
      sample: buildDigestMessage(areaCounts, env.appUrl),
    };
  });
}

/**
 * 旧まとめ通知（エリアごとの件数）を記録だけする（dry run）。LINE へは送らない。
 * 全員（通知設定が既定で ON）への Multicast になるため、送信の機能は外した。
 * LINE への配信は、通知を ON にしたユーザーだけへの「今夜の食べつなぎ」（services/line-digest）で行う。
 */
export async function sendEveningDigest(createdBy: string | null) {
  const preview = await previewEveningDigest();
  const notificationId = await asService(async (q) => {
    const [n] = await q.query<{ id: string }>(
      `insert into public.notifications (kind, title, body, payload, status, target_count, created_by, scheduled_for)
       values ('evening_digest', $1, $2, $3::jsonb, 'dry_run', $4, $5, now()) returning id`,
      [preview.title, preview.sample, JSON.stringify({ areaCounts: preview.areaCounts }), preview.targets.length, createdBy],
    );
    for (const t of preview.targets) {
      await q.query(
        `insert into public.notification_deliveries (notification_id, user_id, message, status)
         values ($1, $2, $3, 'dry_run')`,
        [n.id, t.userId, t.message],
      );
    }
    return n.id;
  });
  return { notificationId, status: "dry_run" as const, sent: 0, targets: preview.targets.length };
}

export async function listNotifications() {
  return asService((q) =>
    q.query<{ id: string; kind: string; title: string; status: string; target_count: number; sent_count: number; created_at: Date }>(
      "select id, kind, title, status, target_count, sent_count, created_at from public.notifications order by created_at desc limit 30",
    ),
  );
}

export { areaLabel };
