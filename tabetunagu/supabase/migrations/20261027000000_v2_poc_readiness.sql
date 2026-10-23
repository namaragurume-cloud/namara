-- ===========================================================================
-- TABETUNAGU v2 STEP 5: PoC 公開前の運用の受け皿
--
-- - ops_heartbeats: 定期処理（/api/cron/orders）が最後に正常に動いた時刻（管理画面の監視用）
-- - sync_refund_status: refund.updated / refund.failed の反映。
--   処理中（pending）の返金が後で失敗したら、注文は戻さず（paid に戻さない）決済を要確認（requires_review）にする。
-- ===========================================================================

create table public.ops_heartbeats (
  key text primary key check (key ~ '^[a-z_]{3,64}$'),
  last_success_at timestamptz not null,
  last_result jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.ops_heartbeats enable row level security;
revoke all on public.ops_heartbeats from public, anon, authenticated;
-- ポリシーなし = anon / authenticated からは参照不可（service のみ）

create or replace function public.record_heartbeat(p_key text, p_result jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.ops_heartbeats (key, last_success_at, last_result, updated_at)
  values (p_key, now(), coalesce(p_result, '{}'::jsonb), now())
  on conflict (key) do update
    set last_success_at = excluded.last_success_at, last_result = excluded.last_result, updated_at = now();
$$;

-- ---------------------------------------------------------------------------
-- 返金状態の同期（Stripe の Refund.status: pending / requires_action / succeeded / failed / canceled）
-- ---------------------------------------------------------------------------
create or replace function public.sync_refund_status(p_provider_refund_id text, p_status text, p_failure_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_refund public.refunds%rowtype;
  v_order public.orders%rowtype;
begin
  select * into v_refund from public.refunds where provider = 'stripe' and provider_refund_id = p_provider_refund_id for update;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;

  if p_status = 'succeeded' then
    if v_refund.status in ('requested', 'pending') then
      update public.refunds set status = 'succeeded', succeeded_at = now() where id = v_refund.id;
      return jsonb_build_object('result', 'succeeded', 'refund_id', v_refund.id);
    end if;
    return jsonb_build_object('result', 'unchanged', 'refund_id', v_refund.id, 'status', v_refund.status);
  end if;

  if p_status in ('failed', 'canceled') then
    if v_refund.status = 'failed' then
      return jsonb_build_object('result', 'unchanged', 'refund_id', v_refund.id, 'status', 'failed');
    end if;
    update public.refunds
    set status = 'failed', failed_at = now(),
        failure_reason = left('provider_' || p_status || coalesce(':' || p_failure_reason, ''), 500)
    where id = v_refund.id;
    -- 注文は refunded（または cancelled）のまま。お客様に返金できていないため、決済を要確認にする
    update public.payments
    set status = 'requires_review', failure_reason = left('refund_failed' || coalesce(':' || p_failure_reason, ''), 500)
    where id = v_refund.payment_id;
    select * into v_order from public.orders where id = v_refund.order_id;
    insert into public.events (name, user_id, store_id, properties)
    values ('refund_failed', v_order.user_id, v_order.store_id,
            jsonb_build_object('order_id', v_order.id, 'refund_id', v_refund.id, 'reason', p_failure_reason));
    return jsonb_build_object('result', 'failed', 'refund_id', v_refund.id);
  end if;

  -- pending / requires_action: 処理中のまま
  return jsonb_build_object('result', 'pending', 'refund_id', v_refund.id);
end
$$;

revoke execute on function
  public.record_heartbeat(text, jsonb),
  public.sync_refund_status(text, text, text)
from public, anon, authenticated;
