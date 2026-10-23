import "server-only";
import { storeReadiness, type StoreReadinessInput } from "@/lib/readiness";
import { asService } from "../db";

/**
 * 店舗の導入準備の状態。呼び出し側で権限（店舗メンバー / 管理者）を確認すること。
 */
export async function getStoreReadiness(storeIds?: string[]) {
  const rows = await asService((q) =>
    q.query<{
      id: string;
      active: boolean;
      info: boolean;
      products: number;
      published: number;
      stripe: boolean;
      monitor: boolean;
    }>(
      `select s.id,
              s.status = 'active' as active,
              (s.address <> '' and s.phone <> '' and s.opening_hours <> '') as info,
              (select count(*) from public.products p where p.store_id = s.id and p.deleted_at is null)::int as products,
              (select count(*) from public.products p where p.store_id = s.id and p.deleted_at is null
                 and p.status = 'published' and p.pickup_end_at > now())::int as published,
              (s.stripe_charges_enabled and s.stripe_details_submitted) as stripe,
              exists (select 1 from public.events e where e.store_id = s.id and e.name = 'monitor_opened'
                        and e.created_at > now() - interval '30 days') as monitor
       from public.stores s
       where $1::uuid[] is null or s.id = any($1::uuid[])`,
      [storeIds ?? null],
    ),
  );
  return new Map(
    rows.map((r) => {
      const input: StoreReadinessInput = {
        storeActive: r.active,
        hasStoreInfo: r.info,
        productCount: Number(r.products),
        publishedCount: Number(r.published),
        stripeReady: r.stripe,
        monitorOpened: r.monitor,
      };
      return [r.id, storeReadiness(input)] as const;
    }),
  );
}
